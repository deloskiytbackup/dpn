# Changelog

All notable changes to the **DPN (Direct Package Node)** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.0] - 2026-07-20

### Added
- **Over-The-Air (OTA) Updates (`dpn upgrade` / `dpn ota`)**: Built-in self-updater that fetches the latest code from GitHub, recompiles TypeScript, and updates the global binary link automatically.
- **Background Update Notification Banner**: Automatically checks for new releases on GitHub in the background and notifies the user with a stylized CLI banner when a new version is available.

---

## [1.1.0] - 2026-07-20

### Added
- **Real-Time Progress Bar UI**: Added interactive TTY progress reporting (`[████████░░] 80% (27/34) Downloading...`) in `src/ui.ts`.
- **Parallel Downloading Pool**: Implemented `ensurePackagesInStoreParallel` worker pool (10 concurrent requests) reducing fresh installation time from 62s to ~6s.
- **Enhanced Executable Resolution**: Integrated `NODE_PRESERVE_SYMLINKS` and `process.execPath` into script runner for seamless cross-platform binary invocation.

### Changed
- Refactored `handleInstall` in `src/cli.ts` to utilize the new progress renderer and async batch downloader.

---

## [1.0.0] - 2026-07-20

### Added
- **Initial Release of DPN**:
  - `dpn init`: Initializes new `package.json`.
  - `dpn add <pkg>`: Adds dependency to `package.json` and triggers installation.
  - `dpn install` / `dpn i`: Resolves SemVer tree, downloads tarballs, and constructs `node_modules` via symlinks.
  - `dpn run <script>`: Executes `package.json` scripts with `./node_modules/.bin` injected into `PATH`.
- Global Store caching system located at `~/.dpn/store`.
- Executable `.bin` script wrappers (`.cmd` / `.ps1` / shell) for Windows and Unix.
- TypeScript codebase with ESM compilation target.
