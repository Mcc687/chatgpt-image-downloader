# Architecture

The project uses a Manifest V3 Chrome extension plus a small Windows native messaging host.

```text
ChatGPT generated-image gallery
        |
        | content.js detects the hovered gallery and collects image URLs
        v
Chrome service worker (background.js)
        |
        | asks content.js to fetch each image in the ChatGPT page context
        | and sends base64 image data through Native Messaging
        v
Windows native host (NativeHost.cs / .exe)
        |
        | opens a folder picker and writes 1.png, 2.png, 3.png ...
        v
User-selected local folder
```

## Components

- `content.js`: gallery discovery, lazy-thumbnail handling, hover button, status UI, and authenticated image fetching.
- `background.js`: batch orchestration, progress reporting, and native messaging.
- `native-host/NativeHost.cs`: folder selection, filename allocation, MIME-to-extension mapping, and file writing.
- `native-host/install-native-helper.ps1`: detects the unpacked extension ID and writes the per-machine native messaging manifest and registry entry.

## Important design choices

- The folder is selected for every batch; no persistent write permission is requested.
- Numeric names never overwrite existing numeric files. Saving continues from the largest existing number.
- ChatGPT blob URLs are fetched in the page's content-script context because the service worker cannot reliably read them directly.
- Off-screen lazy thumbnails are accepted from their assigned `src` URL even when `currentSrc` and natural dimensions are still empty.
- `native-host-manifest.json` is generated locally and intentionally excluded from Git because it contains an absolute path and the current unpacked extension ID.

## Trust boundary

The extension is intentionally narrow. It only activates on ChatGPT/OpenAI hosts declared in `manifest.json`. The native host accepts `choose_folder` and `save_image` messages and writes only into the folder selected by the user for that connection.
