# 🚀 DPN (Direct Package Node)

🇬🇧 **English** | 🇵🇱 [Polski](README.pl.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Version](https://img.shields.io/badge/version-1.1.0-orange.svg)](CHANGELOG.md)

**DPN** is a fast, modern custom package manager for Node.js built around a Content-Addressable Store architecture (`~/.dpn/store`) and smart symbolic links / junctions.

DPN eliminates duplicate disk storage and speeds up package re-installs by up to **2x compared to standard `npm`**.

---

## ✨ Key Features

- 🔄 **Over-The-Air (OTA) Updates (v1.3.0)**: Built-in self-updater (`dpn upgrade`) that automatically fetches, builds, and re-links the latest version directly from GitHub!
- ⚡ **Concurrent Downloader (v1.1.0)**: Parallelized fetching pool (up to 10 connections) reducing install time for 30+ packages down to ~3 seconds!
- 🎨 **CLI Progress Bar**: Real-time terminal progress reporting (`[████████░░] 80% (27/34) Downloading...`).
- 🔗 **Symlink / Junction Architecture**: Strict `node_modules` structure built with symlinks prevents ghost dependencies and saves disk space.
- 📦 **Executable Binary Support**: Automatically sets up `.bin` wrappers (`.cmd`, `.ps1`, shell) for executable packages (`cowsay`, `esbuild`, `tsc`, etc.).
- 🛠️ **SemVer & Registry Compatible**: Full support for `https://registry.npmjs.org` and SemVer version ranges (`^`, `~`, `latest`).

---

## 🚀 Installation & Quick Start

### Global Installation

Clone the repository and link `dpn` globally on your system:

```bash
git clone https://github.com/deloskiytbackup/dpn.git
cd dpn
npm install
npm run build
npm link
```

Once linked, the `dpn` command will be available anywhere in your command line / PowerShell!

---

## 🛠️ CLI Commands

```bash
# 1. Initialize a new package.json in current directory
dpn init

# 2. Add and install a new dependency
dpn add lodash
dpn add express@latest

# 3. Install all dependencies from package.json
dpn install
# or short alias
dpn i

# 4. Auto-update DPN to latest version Over-The-Air (OTA)
dpn upgrade

# 5. Run scripts defined in package.json with node_modules/.bin in PATH
dpn run <script_name>

# 5. Display help and version
dpn --help
dpn --version
```

---

## 📊 Speed Benchmark Comparison

Benchmark executed across `express`, `lodash`, `axios`, and `cowsay` including all recursive sub-dependencies (34 unique packages):

| Package Manager | 💥 Warm Cache (Re-install) | ❄️ Cold Cache (Fresh install) |
| :--- | :--- | :--- |
| ⚡ **`dpn`** | **3.35 s** 🚀 | **6.40 s** (with v1.1 parallel fetch) |
| 🚀 **`pnpm`** | **8.59 s** | **3.29 s** |
| 🐢 **`npm`** | **42.15 s** | **11.62 s** |

---

## 🏗️ Project Architecture

```
dpn/
├── bin/
│   └── dpn.js             # CLI entrypoint with shebang
├── src/
│   ├── cli.ts             # CLI command routing and main execution
│   ├── ui.ts              # Terminal progress bar UI renderer
│   ├── registry.ts        # Metadata & tarball downloader for registry.npmjs.org
│   ├── resolver.ts        # Recursive SemVer dependency resolution engine
│   ├── store.ts           # Parallel caching store (~/.dpn/store)
│   ├── linker.ts          # Symlink & junction linker for node_modules and .bin
│   └── runner.ts          # Script execution engine for dpn run
├── package.json
├── tsconfig.json
├── CHANGELOG.md
├── README.md              # English documentation
├── README.pl.md           # Polish documentation
└── LICENSE
```

---

## 📄 License

Distributed under the [MIT License](LICENSE).
