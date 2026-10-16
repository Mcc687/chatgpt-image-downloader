# Contributing

Issues and pull requests are welcome. Please keep changes focused on the ChatGPT image downloader and avoid committing browser profiles, cookies, tokens, machine-specific paths, or generated native-host manifests.

## Development flow

1. Fork and clone the repository on Windows.
2. Make the change in a feature branch.
3. Run `powershell -ExecutionPolicy Bypass -File .\verify.ps1`.
4. Reload the unpacked extension in `chrome://extensions` and refresh the ChatGPT tab.
5. Test a single-image response and a scrollable 10-image response.
6. Open a pull request that explains the user-visible behavior and verification performed.

See [Development](docs/DEVELOPMENT.md) for build details and [Architecture](docs/ARCHITECTURE.md) for the data flow.
