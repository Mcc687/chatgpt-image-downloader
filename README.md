# GPT 图片一键下载

[![Verify](https://github.com/Mcc687/chatgpt-image-downloader/actions/workflows/verify.yml/badge.svg)](https://github.com/Mcc687/chatgpt-image-downloader/actions/workflows/verify.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

一个面向 Windows + Chrome 的轻量扩展：在 ChatGPT 生成图片组上悬停，点击一次即可选择本地文件夹，把整组图片按 `1、2、3…` 连续编号保存。

项目公开提供完整源码、Windows 本地助手源码与预编译文件，便于学习实现思路、适配 ChatGPT 界面变化或继续二次开发。

## 功能

- 自动识别 ChatGPT 新版生成图片画廊。
- 无需先滚动缩略图，也能识别延迟加载的整组图片。
- 每批下载都可以重新选择保存文件夹。
- 自动按 `1.png`、`2.png`、`3.png`……命名。
- 已有数字文件不会被覆盖，会从最大编号继续。
- 现代 Windows 文件夹选择器，并兼容旧版回退。
- 下载按钮显示图片总数；状态卡显示准备、进度、成功、取消和失败。
- 支持 ChatGPT 明暗主题。

## 支持环境

- Windows 10 / 11
- Google Chrome
- `chatgpt.com`

目前没有 macOS、Linux、Edge 或 Chrome Web Store 正式包。

## 安装

1. 从 [Releases](https://github.com/Mcc687/chatgpt-image-downloader/releases) 下载最新版本，或点击 GitHub 的 **Code → Download ZIP**。
2. 解压到一个固定文件夹，之后不要随意移动。
3. 在 Chrome 地址栏打开 `chrome://extensions`。
4. 开启右上角的 **开发者模式**。
5. 点击 **加载已解压的扩展程序**，选择能直接看到 `manifest.json` 的文件夹。
6. 双击运行根目录中的 `install-native-helper.cmd`。
7. 回到扩展管理页，点击本扩展的 **重新加载**。
8. 刷新已经打开的 ChatGPT 标签页。

安装脚本会自动识别 Chrome 给当前解压目录分配的扩展 ID，并为当前 Windows 用户注册本地下载助手，不需要手工修改配置或管理员权限。

## 使用

1. 打开包含 GPT 生成图片的 ChatGPT 对话。
2. 把鼠标移到生成图片组上。
3. 点击右上角带数量角标的绿色下载按钮。
4. 在 Windows 窗口中选择本批图片的保存文件夹。
5. 等待右下角状态卡显示完成。

每次下载都会重新选择文件夹。图片按数字连续命名；目标目录里若已有 `1.png` 到 `10.png`，新文件会从 `11` 开始。

## 更新

### 使用 Git

```powershell
git pull
```

然后在 `chrome://extensions` 重新加载扩展，并刷新 ChatGPT 页面。只有扩展目录、扩展 ID 或本地助手发生变化时，才需要重新运行 `install-native-helper.cmd`。

### 使用 ZIP

下载新版本后，把文件覆盖到原来的固定目录，再重新加载扩展并刷新 ChatGPT。不要每次换一个新的解压路径，否则 Chrome 可能分配新的扩展 ID；如果路径或 ID 已变化，请重新运行安装脚本。

## 常见问题

### `Extension context invalidated`

扩展刚刚重新加载，但当前 ChatGPT 标签页仍运行旧脚本。刷新该 ChatGPT 标签页即可。

### 下载按钮数量少于缩略图数量

2.1.2 及以上已修复 ChatGPT 缩略图懒加载造成的漏图。请确认扩展版本，并同时重新加载扩展、刷新页面。

### 无法启动 Windows 下载助手

确认已先在 Chrome 加载扩展，再运行 `install-native-helper.cmd`。如果移动了项目目录或重新加载后扩展 ID 变化，请再次运行安装脚本。

### 如何卸载

1. 在 Chrome 扩展管理页移除扩展。
2. 双击 `uninstall-native-helper.cmd` 删除当前用户的本地助手注册。
3. 删除项目文件夹。

## 隐私与权限

- 扩展不上传图片，不使用第三方服务器，也不收集账号、Cookie、Token 或对话文本。
- 图片数据从当前 ChatGPT 页面读取，经 Chrome Native Messaging 交给本机助手，再写入用户当次选择的文件夹。
- `tabs` 用于与当前 ChatGPT 标签页协作；`nativeMessaging` 用于调用 Windows 下载助手。
- 本地生成的 `native-host/native-host-manifest.json` 含当前电脑的绝对路径和扩展 ID，已被 `.gitignore` 排除，不会提交到仓库。

## 开发

```powershell
powershell -ExecutionPolicy Bypass -File .\verify.ps1
```

进一步阅读：

- [架构说明](docs/ARCHITECTURE.md)
- [开发与测试](docs/DEVELOPMENT.md)
- [参与贡献](CONTRIBUTING.md)
- [变更记录](CHANGELOG.md)
- [安全策略](SECURITY.md)

## 许可

本项目使用 [MIT License](LICENSE)，允许学习、修改、分发和二次开发，但需保留原版权和许可声明。
