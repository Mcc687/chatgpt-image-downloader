using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal static class NativeHost
{
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer
    {
        MaxJsonLength = 64 * 1024 * 1024,
        RecursionLimit = 32
    };
    private static readonly Stream Input = Console.OpenStandardInput();
    private static readonly Stream Output = Console.OpenStandardOutput();
    private static string selectedFolder;
    private static int nextIndex;

    [Flags]
    private enum FileOpenOptions : uint
    {
        PickFolders = 0x00000020,
        ForceFileSystem = 0x00000040,
        NoChangeDirectory = 0x00000008,
        PathMustExist = 0x00000800,
        DontAddToRecent = 0x02000000
    }

    private enum ShellDisplayName : uint
    {
        FileSystemPath = 0x80058000
    }

    [ComImport]
    [Guid("DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7")]
    private class NativeFileOpenDialog
    {
    }

    [ComImport]
    [Guid("d57c7288-d4ad-4768-be02-9d969532d960")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IFileOpenDialog
    {
        [PreserveSig] int Show(IntPtr parent);
        void SetFileTypes(uint count, IntPtr filterSpecs);
        void SetFileTypeIndex(uint index);
        void GetFileTypeIndex(out uint index);
        void Advise(IntPtr events, out uint cookie);
        void Unadvise(uint cookie);
        void SetOptions(FileOpenOptions options);
        void GetOptions(out FileOpenOptions options);
        void SetDefaultFolder(IShellItem folder);
        void SetFolder(IShellItem folder);
        void GetFolder(out IShellItem folder);
        void GetCurrentSelection(out IShellItem item);
        void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string name);
        void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string title);
        void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
        void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
        void GetResult(out IShellItem item);
        void AddPlace(IShellItem item, int alignment);
        void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string extension);
        void Close(int result);
        void SetClientGuid(ref Guid guid);
        void ClearClientData();
        void SetFilter(IntPtr filter);
        void GetResults(out IntPtr items);
        void GetSelectedItems(out IntPtr items);
    }

    [ComImport]
    [Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IShellItem
    {
        void BindToHandler(IntPtr bindContext, ref Guid handlerId, ref Guid interfaceId, out IntPtr result);
        void GetParent(out IShellItem parent);
        void GetDisplayName(ShellDisplayName displayName, out IntPtr name);
        void GetAttributes(uint mask, out uint attributes);
        void Compare(IShellItem item, uint hint, out int order);
    }

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = true)]
    private static extern int SHCreateItemFromParsingName(
        [MarshalAs(UnmanagedType.LPWStr)] string path,
        IntPtr bindContext,
        ref Guid interfaceId,
        out IShellItem item);

    private sealed class WindowHandle : IWin32Window
    {
        public WindowHandle(IntPtr handle) { Handle = handle; }
        public IntPtr Handle { get; private set; }
    }

    [STAThread]
    private static int Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        try
        {
            while (true)
            {
                Dictionary<string, object> message = ReadMessage();
                if (message == null) return 0;
                HandleMessage(message);
            }
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error);
            TrySend(new Dictionary<string, object> { { "type", "error" }, { "message", error.Message } });
            return 1;
        }
    }

    private static void HandleMessage(Dictionary<string, object> message)
    {
        string type = ValueAsString(message, "type");
        if (type == "choose_folder")
        {
            ChooseFolder();
            return;
        }
        if (type == "save_image")
        {
            SaveImage(message);
            return;
        }
        Send(new Dictionary<string, object> { { "type", "error" }, { "message", "未知的下载助手请求" } });
    }

    private static void ChooseFolder()
    {
        IntPtr foregroundWindow = GetForegroundWindow();
        string folder;
        try
        {
            folder = ShowModernFolderPicker(foregroundWindow);
        }
        catch
        {
            folder = ShowLegacyFolderPicker(foregroundWindow);
        }

        if (String.IsNullOrWhiteSpace(folder))
        {
            Send(new Dictionary<string, object> { { "type", "cancelled" } });
            return;
        }

        selectedFolder = folder;
        nextIndex = FindNextIndex(selectedFolder);
        Send(new Dictionary<string, object> { { "type", "folder_ready" }, { "nextIndex", nextIndex } });
    }

    private static string ShowModernFolderPicker(IntPtr owner)
    {
        IFileOpenDialog dialog = (IFileOpenDialog)new NativeFileOpenDialog();
        IShellItem result = null;
        try
        {
            FileOpenOptions options;
            dialog.GetOptions(out options);
            dialog.SetOptions(options
                | FileOpenOptions.PickFolders
                | FileOpenOptions.ForceFileSystem
                | FileOpenOptions.NoChangeDirectory
                | FileOpenOptions.PathMustExist
                | FileOpenOptions.DontAddToRecent);
            dialog.SetTitle("选择这批 GPT 图片的保存文件夹");
            dialog.SetOkButtonLabel("保存到此文件夹");

            string pictures = Environment.GetFolderPath(Environment.SpecialFolder.MyPictures);
            IShellItem initialFolder = null;
            try
            {
                Guid shellItemId = typeof(IShellItem).GUID;
                if (!String.IsNullOrWhiteSpace(pictures)
                    && SHCreateItemFromParsingName(pictures, IntPtr.Zero, ref shellItemId, out initialFolder) >= 0)
                {
                    dialog.SetFolder(initialFolder);
                }
            }
            finally
            {
                if (initialFolder != null) Marshal.ReleaseComObject(initialFolder);
            }

            int showResult = dialog.Show(owner);
            if (showResult == unchecked((int)0x800704C7)) return null;
            if (showResult < 0) Marshal.ThrowExceptionForHR(showResult);

            dialog.GetResult(out result);
            IntPtr pathPointer;
            result.GetDisplayName(ShellDisplayName.FileSystemPath, out pathPointer);
            try
            {
                return Marshal.PtrToStringUni(pathPointer);
            }
            finally
            {
                Marshal.FreeCoTaskMem(pathPointer);
            }
        }
        finally
        {
            if (result != null) Marshal.ReleaseComObject(result);
            Marshal.ReleaseComObject(dialog);
        }
    }

    private static string ShowLegacyFolderPicker(IntPtr owner)
    {
        using (FolderBrowserDialog dialog = new FolderBrowserDialog())
        {
            dialog.Description = "选择本批 GPT 图片的保存文件夹";
            dialog.ShowNewFolderButton = true;
            dialog.SelectedPath = Environment.GetFolderPath(Environment.SpecialFolder.MyPictures);
            DialogResult result = owner == IntPtr.Zero
                ? dialog.ShowDialog()
                : dialog.ShowDialog(new WindowHandle(owner));
            return result == DialogResult.OK ? dialog.SelectedPath : null;
        }
    }

    private static void SaveImage(Dictionary<string, object> message)
    {
        if (String.IsNullOrWhiteSpace(selectedFolder))
        {
            Send(new Dictionary<string, object> { { "type", "error" }, { "message", "请先选择保存文件夹" } });
            return;
        }

        string dataUrl = ValueAsString(message, "dataUrl");
        int commaPosition = dataUrl.IndexOf(',');
        if (commaPosition < 0)
        {
            Send(new Dictionary<string, object> { { "type", "error" }, { "message", "图片数据格式不正确" } });
            return;
        }

        string extension = ExtensionForMime(ValueAsString(message, "mime"));
        string filename;
        do
        {
            filename = nextIndex.ToString() + extension;
            nextIndex += 1;
        } while (File.Exists(Path.Combine(selectedFolder, filename)));

        byte[] bytes = Convert.FromBase64String(dataUrl.Substring(commaPosition + 1));
        File.WriteAllBytes(Path.Combine(selectedFolder, filename), bytes);
        Send(new Dictionary<string, object> { { "type", "saved" }, { "filename", filename } });
    }

    private static int FindNextIndex(string folder)
    {
        int highest = 0;
        foreach (string path in Directory.GetFiles(folder))
        {
            string name = Path.GetFileNameWithoutExtension(path);
            int number;
            if (Int32.TryParse(name, out number) && number > highest) highest = number;
        }
        return highest + 1;
    }

    private static string ExtensionForMime(string mime)
    {
        switch (mime.ToLowerInvariant())
        {
            case "image/avif": return ".avif";
            case "image/gif": return ".gif";
            case "image/jpeg":
            case "image/jpg": return ".jpg";
            case "image/webp": return ".webp";
            case "image/svg+xml": return ".svg";
            default: return ".png";
        }
    }

    private static Dictionary<string, object> ReadMessage()
    {
        byte[] lengthBuffer = ReadExactly(4);
        if (lengthBuffer == null) return null;
        int length = BitConverter.ToInt32(lengthBuffer, 0);
        if (length <= 0 || length > 64 * 1024 * 1024) throw new InvalidDataException("收到无效的本地消息长度");
        byte[] data = ReadExactly(length);
        if (data == null) throw new EndOfStreamException("本地消息意外结束");
        return Json.Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(data));
    }

    private static byte[] ReadExactly(int length)
    {
        byte[] buffer = new byte[length];
        int total = 0;
        while (total < length)
        {
            int read = Input.Read(buffer, total, length - total);
            if (read == 0) return null;
            total += read;
        }
        return buffer;
    }

    private static string ValueAsString(Dictionary<string, object> message, string key)
    {
        object value;
        return message.TryGetValue(key, out value) && value != null ? Convert.ToString(value) : String.Empty;
    }

    private static void TrySend(Dictionary<string, object> message)
    {
        try { Send(message); } catch { }
    }

    private static void Send(Dictionary<string, object> message)
    {
        byte[] data = Encoding.UTF8.GetBytes(Json.Serialize(message));
        byte[] length = BitConverter.GetBytes(data.Length);
        Output.Write(length, 0, length.Length);
        Output.Write(data, 0, data.Length);
        Output.Flush();
    }
}
