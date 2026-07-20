# 🚀 DPN (Direct Package Node)

🇬🇧 **English** | 🇵🇱 [Polski](README.pl.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Version](https://img.shields.io/badge/version-2.3.0-orange.svg)](CHANGELOG.md)

**DPN** is a high-performance, next-generation custom package manager for Node.js. Built around a Content-Addressable Store architecture (`~/.dpn/store`), in-memory streaming extraction, and Windows-native directory junctions.

DPN eliminates duplicate disk storage, protects against ghost dependencies, and accelerates installs up to **12x faster than `npm`** and **2.5x faster than `pnpm` on Warm Cache re-installs**.

---

## 📊 Package Manager Comparison: npm vs pnpm vs bun vs DPN

| Feature / Metric | npm | pnpm | bun | DPN (Ours) |
| :--- | :--- | :--- | :--- | :--- |
| **Architecture** | Flat `node_modules` | Symlink CAS Store | Global Cache | **Symlink CAS Store** |
| **Disk Space Efficiency** | 🔴 Low (Copies) | 🟢 Very High | 🟡 Medium | **🟢 Very High** |
| **Parallel Downloads** | 🟡 Medium | 🟢 Very Fast | 🟢 Ultra Fast | **🟢 16-Worker Pool** |
| **In-Memory RAM Extraction** | ❌ No (Disk tgz) | ❌ No (Disk tgz) | 🟢 Binary | **🟢 Streaming RAM (v2.0)** |
| **Ghost Dependencies** | ❌ Allowed | ✅ Blocked | ❌ Allowed | **✅ Blocked** |
| **Windows Compatibility**| 🟡 Medium | 🟡 Junction issues | 🔴 Poor | **🟢 100% Native (.cmd/.ps1)** |
| **Over-The-Air (OTA)** | ❌ No | ❌ No | ❌ No | **✅ Built-in (`dpn upgrade`)** |
| **Lockfile Standard** | `package-lock.json` | `pnpm-lock.yaml` | `bun.lockb` | **`dpn-lock.json`** |
| **CLI Progress Bar** | 🟡 Basic | 🟢 Detailed | 🟢 Fast | **🟢 Live MB/s & Size ANSI Bar** |

---

## ⚡ Performance Benchmark (34 packages: `express`, `lodash`, `axios`, `cowsay`)

| Package Manager | 💥 Warm Cache (Re-install) | ❄️ Cold Cache (Fresh Install) |
| :--- | :--- | :--- |
| **⚡ DPN (v2.3.0)** | **3.35 s 🚀 (Fastest Re-install)** | **3.10 s 🚀 (In-Memory RAM Streaming)** |
| **🚀 pnpm** | 8.59 s | 3.29 s |
| **🐢 npm** | 42.15 s | 11.62 s |

---

## ✨ Key Features

- 🔄 **Over-The-Air (OTA) Updates (`dpn upgrade`)**: Self-upgrading CLI that automatically checks, fetches, compiles, and re-links the latest version directly from GitHub!
- ⚡ **In-Memory Streaming Extraction (v2.0)**: Tarball archives are extracted in-memory directly from the HTTP stream without saving temporary `.tgz` files to disk.
- 🚀 **Parallel Dependency Tree Resolver (v2.0)**: Drills down recursive sub-dependencies using `Promise.all` in milliseconds.
- 📈 **Live Transfer Speed & Size Progress Bar**: Real-time progress bar reporting live transfer speeds (`14.2 MB/s`), byte sizes (`45.6 MB`), and current package metadata analysis.
- 🎯 **Custom Version & Exact Specs**: Full support for `dpn add prisma -version 5.10.0`, `@5.10.0`, and `--exact` (`-E`) flags.
- 🔗 **Strict Symlink / Junction Architecture**: Prevents ghost dependencies and reuses central store packages in `~/.dpn/store`.
- ⚙️ **Windows-Native Bin Wrappers**: Automatically creates `.cmd` and `.ps1` wrappers with `NODE_PRESERVE_SYMLINKS` for executable tools (`prisma`, `tsc`, `vite`, `next`, `esbuild`).

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

Once linked, the `dpn` command is available anywhere in your terminal or PowerShell!

---

## 🛠️ CLI Commands & Usage

```bash
# 1. Initialize a new package.json in current directory
dpn init

# 2. Add and install dependencies with custom version support
dpn add lodash
dpn add express@latest
dpn add prisma -version 5.10.0
dpn add @prisma/client@5.10.0 --exact

# 3. Install all dependencies from package.json
dpn install
# or short alias
dpn i

# 4. Update dependencies to latest versions from NPM registry
dpn update
dpn update express lodash

# 5. Compare performance & features matrix (npm vs pnpm vs bun vs DPN)
dpn compare
# or short aliases
dpn bench

# 6. Run scripts defined in package.json with node_modules/.bin in PATH
dpn run build
dpn run dev

# 7. Auto-update DPN CLI to latest version Over-The-Air (OTA)
dpn upgrade

# 8. Display help and version
dpn --help
dpn --version
```

---

## 🌐 Deploying with DPN on Vercel (CI/CD)

You can easily use DPN as your custom package manager for Vercel deployments!

### Option A: Using `vercel.json` (Recommended)

Create a `vercel.json` file in the root of your project:

```json
{
  "installCommand": "npm i -g github:deloskiytbackup/dpn && dpn install",
  "buildCommand": "dpn run build"
}
```

### Option B: Vercel Dashboard Settings

1. Go to your project on Vercel ➔ **Settings** ➔ **Build & Development Settings**.
2. Enable **Override** for:
   - **Install Command**: `npm i -g github:deloskiytbackup/dpn && dpn install`
   - **Build Command**: `dpn run build`

---

## 🏗️ Project Architecture

```
dpn/
├── bin/
│   └── dpn.js             # CLI entrypoint with shebang
├── src/
│   ├── cli.ts             # CLI command routing, main execution & progress spinners
│   ├── ui.ts              # ANSI Spinner & Progress Bar renderer with MB/s & Bps
│   ├── registry.ts        # Metadata fetcher for registry.npmjs.org
│   ├── resolver.ts        # Parallel recursive SemVer dependency resolution engine
│   ├── store.ts           # In-memory streaming extraction & store (~/.dpn/store)
│   ├── ota.ts             # GitHub REST API Over-The-Air auto-updater
│   ├── linker.ts          # Symlink, junction & binary wrapper linker (.cmd/.ps1)
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
