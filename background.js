const NATIVE_HOST = "com.gpt_image_downloader.host";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function sendAndWait(port, message) {
  return new Promise((resolve, reject) => {
    const onMessage = (response) => {
      cleanup();
      resolve(response);
    };
    const onDisconnect = () => {
      cleanup();
      reject(new Error(chrome.runtime.lastError?.message || "Windows 下载助手已断开"));
    };
    const cleanup = () => {
      port.onMessage.removeListener(onMessage);
      port.onDisconnect.removeListener(onDisconnect);
    };
    port.onMessage.addListener(onMessage);
    port.onDisconnect.addListener(onDisconnect);
    try {
      port.postMessage(message);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

async function prepareImage(tabId, url) {
  const response = await chrome.tabs.sendMessage(tabId, { type: "PREPARE_IMAGE", url });
  if (!response?.dataUrl) {
    throw new Error(response?.error || "无法从 ChatGPT 读取图片，请保持原对话页面打开");
  }
  return response;
}

async function reportProgress(tabId, current, total) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "DOWNLOAD_PROGRESS", current, total });
  } catch {
    // Progress UI is optional; saving should continue if the page was closed.
  }
}

async function saveBatchWithWindowsHelper(tabId, images) {
  const port = chrome.runtime.connectNative(NATIVE_HOST);
  try {
    const folderResult = await sendAndWait(port, { type: "choose_folder" });
    if (folderResult?.type === "cancelled") {
      return { ok: false, message: "已取消选择保存文件夹。" };
    }
    if (folderResult?.type !== "folder_ready") {
      throw new Error(folderResult?.message || "Windows 下载助手没有返回保存文件夹");
    }

    let saved = 0;
    let processed = 0;
    const failures = [];
    const firstIndex = folderResult.nextIndex;
    await reportProgress(tabId, 0, images.length);
    for (const source of images) {
      try {
        const image = await prepareImage(tabId, source.url);
        const result = await sendAndWait(port, {
          type: "save_image",
          dataUrl: image.dataUrl,
          mime: image.mime || "",
          sourceUrl: source.url
        });
        if (result?.type !== "saved") throw new Error(result?.message || "图片未能保存");
        saved += 1;
      } catch (error) {
        failures.push(getErrorMessage(error));
      } finally {
        processed += 1;
        await reportProgress(tabId, processed, images.length);
      }
    }

    const range = saved === 1 ? String(firstIndex) : `${firstIndex}–${firstIndex + saved - 1}`;
    const failureNote = failures.length ? `；${failures.length} 张未能保存` : "";
    return saved
      ? { ok: true, message: `已保存 ${saved} 张图片，编号 ${range}${failureNote}` }
      : { ok: false, message: `图片未能保存：${failures[0] || "未知错误"}` };
  } finally {
    try {
      port.disconnect();
    } catch {
      // The host may already have exited after a cancelled folder dialog.
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "BEGIN_BATCH_DOWNLOAD") return;

  const tabId = sender.tab?.id;
  const images = Array.isArray(message.images)
    ? message.images.filter((image) => typeof image?.url === "string")
    : [];
  if (!Number.isInteger(tabId) || !images.length) {
    sendResponse({ ok: false, message: "没有找到可下载的图片。" });
    return;
  }

  saveBatchWithWindowsHelper(tabId, images)
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, message: `无法启动 Windows 下载助手：${getErrorMessage(error)}` }));
  return true;
});
