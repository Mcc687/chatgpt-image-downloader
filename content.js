(() => {
  const BUTTON_ID = "gpt-image-downloader-button";
  const TOAST_ID = "gpt-image-downloader-toast";
  let toastTimer;
  let hideButtonTimer;
  let activeGroup;

  function ensureToast() {
    let toast = document.getElementById(TOAST_ID);
    if (toast) return toast;

    toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.innerHTML = `
      <span class="gpt-image-downloader-toast-icon" aria-hidden="true"></span>
      <span class="gpt-image-downloader-toast-content">
        <strong class="gpt-image-downloader-toast-title"></strong>
        <span class="gpt-image-downloader-toast-message"></span>
        <span class="gpt-image-downloader-toast-progress" aria-hidden="true"><i></i></span>
      </span>
      <button class="gpt-image-downloader-toast-close" type="button" aria-label="关闭提示">×</button>
    `;
    toast.querySelector(".gpt-image-downloader-toast-close").addEventListener("click", () => {
      clearTimeout(toastTimer);
      toast.classList.remove("is-visible");
    });
    document.documentElement.append(toast);
    return toast;
  }

  function getImageUrl(image) {
    return image.getAttribute("data-original-src") || image.currentSrc || image.src || "";
  }

  function isGeneratedGalleryImage(image) {
    if (image.closest?.(
      '[data-testid="generated-image-preview"], [class~="group/generated-image-preview"], [class~="group/imagegen-image"]'
    )) return true;

    const thumbnailButton = image.closest?.('button[aria-pressed]');
    return Boolean(thumbnailButton?.parentElement?.matches?.('[role="group"], .vertical-scroll-fade-mask'));
  }

  function isUsableImage(image) {
    const url = getImageUrl(image);
    if (!url || url.startsWith("data:image/svg")) return false;
    const label = [image.alt, image.getAttribute("aria-label"), image.title].filter(Boolean).join(" ").toLowerCase();
    if (/avatar|profile|logo|icon|头像|图标/.test(label)) return false;
    // ChatGPT assigns every generated thumbnail a real blob URL immediately, but
    // leaves off-screen thumbnails at naturalWidth/naturalHeight = 0 until the
    // thumbnail rail is scrolled. Treat images inside the generated gallery as
    // usable before native lazy loading has rendered them.
    if (isGeneratedGalleryImage(image)) return true;
    return (image.naturalWidth || image.width || 0) >= 96 && (image.naturalHeight || image.height || 0) >= 96;
  }

  function getImageGroup(image) {
    const generatedPreview = image.closest?.(
      '[data-testid="generated-image-preview"], [class~="group/generated-image-preview"], [class~="group/imagegen-image"]'
    );
    if (generatedPreview) {
      const gallery = generatedPreview.closest?.(
        '[data-testid="generated-image-gallery"], [class~="group/generated-image-gallery-controls"]'
      );
      if (gallery) return gallery.closest(".flex.items-start.gap-2") || gallery.parentElement || gallery;
      return generatedPreview.closest(".flex.items-start.gap-2") || generatedPreview;
    }

    let parent = image.parentElement;
    for (let depth = 0; parent && depth < 10; depth += 1, parent = parent.parentElement) {
      const gallery = parent.querySelector?.(
        '[data-testid="generated-image-gallery"], [class~="group/generated-image-gallery-controls"]'
      );
      if (gallery) return gallery.closest(".flex.items-start.gap-2") || parent;

      const legacyPreview = parent.querySelector?.('[class~="group/imagegen-image"]');
      if (legacyPreview) return legacyPreview.closest(".flex.items-start.gap-2") || parent;
    }
    return null;
  }

  function collectGroupImages(group) {
    const seen = new Set();
    const images = [];
    for (const image of group.querySelectorAll("img")) {
      if (!isUsableImage(image)) continue;
      const url = getImageUrl(image);
      if (seen.has(url)) continue;
      seen.add(url);
      images.push({ url });
    }
    return images;
  }

  function getGroupBox(group) {
    const rects = [...group.querySelectorAll("img")]
      .filter(isUsableImage)
      .map((image) => image.getBoundingClientRect())
      .filter((rect) => rect.width > 20 && rect.height > 20);
    if (!rects.length) return null;
    return {
      top: Math.min(...rects.map((rect) => rect.top)),
      right: Math.max(...rects.map((rect) => rect.right))
    };
  }

  function toDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error("无法读取图片数据"));
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  async function prepareImage(url) {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) throw new Error(`读取图片失败（${response.status}）`);
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) throw new Error("链接返回的不是图片文件");
    return { dataUrl: await toDataUrl(blob), mime: blob.type, url };
  }

  function showToast({ title, message, state = "neutral", persistent = false, progress = null }) {
    const toast = ensureToast();
    toast.querySelector(".gpt-image-downloader-toast-title").textContent = title;
    toast.querySelector(".gpt-image-downloader-toast-message").textContent = message;
    toast.dataset.state = state;
    toast.dataset.hasProgress = String(Number.isFinite(progress));
    toast.style.setProperty("--download-progress", `${Math.max(0, Math.min(100, progress || 0))}%`);
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    if (!persistent) toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 5200);
  }

  async function startDownload(button, group) {
    const images = collectGroupImages(group);
    button.disabled = true;
    button.classList.add("is-loading");
    showToast({
      title: "选择保存位置",
      message: `共 ${images.length} 张图片，选择文件夹后将自动连续编号保存`,
      state: "loading",
      persistent: true,
      progress: 0
    });
    try {
      const result = await chrome.runtime.sendMessage({ type: "BEGIN_BATCH_DOWNLOAD", images });
      if (result?.ok) {
        showToast({ title: "下载完成", message: result.message, state: "success", progress: 100 });
      } else if (/取消/.test(result?.message || "")) {
        showToast({ title: "已取消", message: result.message, state: "neutral" });
      } else {
        showToast({ title: "下载失败", message: result?.message || "图片未能保存", state: "error" });
      }
    } catch (error) {
      showToast({ title: "下载失败", message: error.message, state: "error" });
    } finally {
      button.disabled = false;
      button.classList.remove("is-loading");
    }
  }

  function injectStyle() {
    if (document.getElementById("gpt-image-downloader-style")) return;
    const style = document.createElement("style");
    style.id = "gpt-image-downloader-style";
    style.textContent = `
      #${BUTTON_ID} { position: fixed; z-index: 2147483647; display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid rgb(255 255 255 / 24%); border-radius: 15px; padding: 0; color: #fff; background: linear-gradient(145deg, #19b892, #078867); box-shadow: 0 10px 24px rgb(0 0 0 / 24%), inset 0 1px 0 rgb(255 255 255 / 22%); cursor: pointer; opacity: 0; pointer-events: none; transform: translateY(5px) scale(.94); transition: opacity .18s, transform .18s, box-shadow .18s, filter .18s; }
      #${BUTTON_ID}.is-visible { opacity: 1; pointer-events: auto; transform: translateY(0) scale(1); }
      #${BUTTON_ID}:hover { filter: brightness(1.06); box-shadow: 0 12px 28px rgb(0 0 0 / 30%), inset 0 1px 0 rgb(255 255 255 / 24%); transform: translateY(-1px) scale(1.02); }
      #${BUTTON_ID}:active { transform: translateY(0) scale(.98); }
      #${BUTTON_ID}:focus-visible { outline: 3px solid rgb(16 163 127 / 28%); outline-offset: 3px; }
      #${BUTTON_ID}:disabled { cursor: progress; opacity: .78; filter: saturate(.7); }
      #${BUTTON_ID}::after { content: attr(data-count); position: absolute; top: -7px; right: -7px; display: grid; min-width: 20px; height: 20px; box-sizing: border-box; place-items: center; border: 2px solid #fff; border-radius: 999px; padding: 0 4px; color: #0d5f4d; background: #e8fff8; box-shadow: 0 3px 8px rgb(0 0 0 / 18%); font: 700 11px/1 system-ui, sans-serif; }
      #${BUTTON_ID}:disabled::after { opacity: 0; }
      #${BUTTON_ID} svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2; }
      #${BUTTON_ID}.is-loading svg { animation: gpt-image-downloader-spin .85s linear infinite; }
      #${TOAST_ID} { --toast-accent: #64748b; --toast-soft: #f1f5f9; --download-progress: 0%; position: fixed; right: 24px; bottom: 28px; z-index: 2147483647; display: grid; grid-template-columns: 40px minmax(0, 1fr) 28px; gap: 12px; align-items: start; width: min(380px, calc(100vw - 32px)); box-sizing: border-box; border: 1px solid rgb(15 23 42 / 10%); border-radius: 18px; padding: 14px; color: #0f172a; background: rgb(255 255 255 / 96%); box-shadow: 0 18px 50px rgb(15 23 42 / 18%), 0 2px 8px rgb(15 23 42 / 8%); backdrop-filter: blur(18px); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; opacity: 0; pointer-events: none; transform: translateY(14px) scale(.98); transition: opacity .22s, transform .22s; }
      #${TOAST_ID}.is-visible { opacity: 1; pointer-events: auto; transform: translateY(0) scale(1); }
      #${TOAST_ID}[data-state="loading"] { --toast-accent: #0d9c79; --toast-soft: #e9fbf5; }
      #${TOAST_ID}[data-state="success"] { --toast-accent: #168354; --toast-soft: #eaf8f0; }
      #${TOAST_ID}[data-state="error"] { --toast-accent: #c2413a; --toast-soft: #fff0ef; }
      #${TOAST_ID} .gpt-image-downloader-toast-icon { display: grid; width: 40px; height: 40px; place-items: center; border-radius: 12px; color: var(--toast-accent); background: var(--toast-soft); font: 800 20px/1 system-ui, sans-serif; }
      #${TOAST_ID} .gpt-image-downloader-toast-icon::before { content: "↓"; }
      #${TOAST_ID}[data-state="success"] .gpt-image-downloader-toast-icon::before { content: "✓"; }
      #${TOAST_ID}[data-state="error"] .gpt-image-downloader-toast-icon::before { content: "!"; }
      #${TOAST_ID}[data-state="loading"] .gpt-image-downloader-toast-icon::before { content: ""; width: 17px; height: 17px; box-sizing: border-box; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: gpt-image-downloader-spin .85s linear infinite; }
      #${TOAST_ID} .gpt-image-downloader-toast-content { display: grid; min-width: 0; gap: 3px; padding-top: 1px; }
      #${TOAST_ID} .gpt-image-downloader-toast-title { overflow: hidden; color: inherit; font-size: 14px; font-weight: 700; line-height: 20px; text-overflow: ellipsis; white-space: nowrap; }
      #${TOAST_ID} .gpt-image-downloader-toast-message { color: #64748b; font-size: 12.5px; line-height: 18px; }
      #${TOAST_ID} .gpt-image-downloader-toast-close { display: grid; width: 28px; height: 28px; place-items: center; border: 0; border-radius: 9px; padding: 0; color: #64748b; background: transparent; cursor: pointer; font: 20px/1 system-ui, sans-serif; }
      #${TOAST_ID} .gpt-image-downloader-toast-close:hover { color: #0f172a; background: #f1f5f9; }
      #${TOAST_ID} .gpt-image-downloader-toast-progress { display: none; height: 5px; margin-top: 7px; overflow: hidden; border-radius: 999px; background: #e7edf2; }
      #${TOAST_ID}[data-has-progress="true"] .gpt-image-downloader-toast-progress { display: block; }
      #${TOAST_ID} .gpt-image-downloader-toast-progress i { display: block; width: var(--download-progress); height: 100%; border-radius: inherit; background: var(--toast-accent); transition: width .25s ease; }
      html.dark #${TOAST_ID}, [data-theme="dark"] #${TOAST_ID} { border-color: rgb(255 255 255 / 10%); color: #f8fafc; background: rgb(28 30 33 / 96%); box-shadow: 0 18px 54px rgb(0 0 0 / 38%); }
      html.dark #${TOAST_ID} .gpt-image-downloader-toast-message, [data-theme="dark"] #${TOAST_ID} .gpt-image-downloader-toast-message { color: #aeb7c2; }
      html.dark #${TOAST_ID} .gpt-image-downloader-toast-close, [data-theme="dark"] #${TOAST_ID} .gpt-image-downloader-toast-close { color: #aeb7c2; }
      html.dark #${TOAST_ID} .gpt-image-downloader-toast-close:hover, [data-theme="dark"] #${TOAST_ID} .gpt-image-downloader-toast-close:hover { color: #fff; background: rgb(255 255 255 / 8%); }
      html.dark #${TOAST_ID} .gpt-image-downloader-toast-progress, [data-theme="dark"] #${TOAST_ID} .gpt-image-downloader-toast-progress { background: rgb(255 255 255 / 10%); }
      @keyframes gpt-image-downloader-spin { to { transform: rotate(360deg); } }
    `;
    document.documentElement.append(style);
  }

  function hideButtonSoon() {
    clearTimeout(hideButtonTimer);
    hideButtonTimer = setTimeout(() => document.getElementById(BUTTON_ID)?.classList.remove("is-visible"), 160);
  }

  function showButtonFor(group) {
    const button = document.getElementById(BUTTON_ID);
    const box = getGroupBox(group);
    if (!button || !box) return;
    clearTimeout(hideButtonTimer);
    activeGroup = group;
    const count = collectGroupImages(group).length;
    button.style.left = `${Math.max(8, box.right - 52)}px`;
    button.style.top = `${Math.max(8, box.top + 10)}px`;
    button.dataset.count = String(count);
    button.setAttribute("aria-label", `批量下载这组 ${count} 张图片`);
    button.classList.add("is-visible");
  }

  function injectButton() {
    if (document.getElementById(BUTTON_ID)) return;
    injectStyle();
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.dataset.extensionVersion = "2.2.0";
    button.dataset.count = "";
    button.type = "button";
    button.title = "批量下载这组图片";
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3"/></svg>';
    button.addEventListener("pointerenter", () => clearTimeout(hideButtonTimer));
    button.addEventListener("pointerleave", hideButtonSoon);
    button.addEventListener("click", () => activeGroup && startDownload(button, activeGroup));
    document.documentElement.append(button);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "DOWNLOAD_PROGRESS") {
      const total = Number(message.total) || 0;
      const current = Math.max(0, Math.min(total, Number(message.current) || 0));
      showToast({
        title: current ? "正在保存图片" : "开始保存",
        message: current ? `已处理 ${current} / ${total} 张图片` : `正在准备 ${total} 张图片`,
        state: "loading",
        persistent: true,
        progress: total ? (current / total) * 100 : 0
      });
      return;
    }
    if (message?.type !== "PREPARE_IMAGE") return;
    prepareImage(message.url)
      .then(sendResponse)
      .catch((error) => sendResponse({ url: message.url, error: error.message }));
    return true;
  });

  injectButton();
  function handleImageHover(event) {
    const target = event.target instanceof Element
      ? event.target
      : event.composedPath?.().find((node) => node instanceof Element);
    const image = target?.closest?.("img");
    if (!image || !isUsableImage(image)) return;
    const group = getImageGroup(image);
    if (group) showButtonFor(group);
  }

  document.addEventListener("pointerover", handleImageHover, true);
  document.addEventListener("mouseover", handleImageHover, true);
  document.addEventListener("pointerout", (event) => {
    const image = event.target.closest?.("img");
    if (image && getImageGroup(image)) hideButtonSoon();
  }, true);
})();
