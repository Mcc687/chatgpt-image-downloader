# Changelog

All notable changes to this project are documented here.

## 2.2.0 - 2026-10-16

- Added a modern Windows Explorer-style folder picker with a legacy fallback.
- Redesigned the hover download button and added an image-count badge.
- Added light/dark download status cards for folder selection, progress, success, cancellation, and errors.
- Added per-image save progress from the background worker.

## 2.1.2 - 2026-10-15

- Fixed missing off-screen thumbnails when ChatGPT lazily loads a generated-image rail.
- The downloader now uses every generated thumbnail URL even before the browser renders it.

## 2.1.1 - 2026-10-15

- Updated gallery detection for ChatGPT's newer generated-image DOM structure.
- Restored the hover download control after the ChatGPT interface update.

## 2.0.0

- Replaced the intermediate extension page with a Windows native messaging helper.
- Added per-batch folder selection and collision-safe numeric filenames.
