import fs from 'node:fs';
import path from 'node:path';
import { getPackageStorePath } from './store.js';
import { ResolvedPackage, ResolvedTree } from './resolver.js';

function createSymlink(targetPath: string, linkPath: string, isDirectory: boolean) {
  if (fs.existsSync(linkPath) || isSymlink(linkPath)) {
    try {
      fs.rmSync(linkPath, { recursive: true, force: true });
    } catch {
      // Ignorujemy błędy
    }
  }

  fs.mkdirSync(path.dirname(linkPath), { recursive: true });

  const type = isDirectory ? (process.platform === 'win32' ? 'junction' : 'dir') : 'file';
  fs.symlinkSync(targetPath, linkPath, type);
}

function isSymlink(filePath: string): boolean {
  try {
    const stat = fs.lstatSync(filePath);
    return stat.isSymbolicLink();
  } catch {
    return false;
  }
}

export async function linkPackages(
  tree: ResolvedTree,
  rootResolved: Record<string, string>,
  projectDir: string
): Promise<void> {
  const nodeModulesDir = path.join(projectDir, 'node_modules');
  const virtualStoreDir = path.join(nodeModulesDir, '.dpn');
  const binDir = path.join(nodeModulesDir, '.bin');

  fs.mkdirSync(virtualStoreDir, { recursive: true });
  fs.mkdirSync(binDir, { recursive: true });

  console.log('[dpn linker] Tworzenie dowiązań w node_modules i globalnym store...');

  // 1. Virtual store + powiązanie zależności wewnątrz store
  for (const [key, pkg] of tree.entries()) {
    const storePath = getPackageStorePath(pkg.name, pkg.version);

    // Samo-dowiązanie pakietu wewnątrz store: store/pkg@ver/node_modules/pkg -> store/pkg@ver
    // Gwarantuje to, że rodzicem ścieżki jest zawsze folder node_modules dla kompilatorów SWC / Webpacka
    const storeSelfLink = path.join(storePath, 'node_modules', pkg.name);
    createSymlink(storePath, storeSelfLink, true);

    const virtualPkgDir = path.join(virtualStoreDir, key, 'node_modules', pkg.name);
    createSymlink(storeSelfLink, virtualPkgDir, true);

    for (const [depName, depVersion] of Object.entries(pkg.dependencies)) {
      const depStorePath = getPackageStorePath(depName, depVersion);
      const depStoreSelfLink = path.join(depStorePath, 'node_modules', depName);

      // Dowiązanie w virtualStore
      const depVirtualLinkPath = path.join(virtualStoreDir, key, 'node_modules', depName);
      createSymlink(depStoreSelfLink, depVirtualLinkPath, true);

      // Dowiązanie wewnątrz store izolowanym
      const depStoreLinkPath = path.join(storePath, 'node_modules', depName);
      createSymlink(depStoreSelfLink, depStoreLinkPath, true);
    }
  }

  // 2. Root dependencies
  for (const [rootDepName, rootVersion] of Object.entries(rootResolved)) {
    const key = `${rootDepName}@${rootVersion}`;
    const storePath = getPackageStorePath(rootDepName, rootVersion);
    const storeSelfLink = path.join(storePath, 'node_modules', rootDepName);
    const rootLinkPath = path.join(nodeModulesDir, rootDepName);

    createSymlink(storeSelfLink, rootLinkPath, true);

    const pkg = tree.get(key);
    if (pkg && pkg.bin) {
      setupBinaries(pkg, rootLinkPath, binDir, nodeModulesDir);
    }
  }
}

function setupBinaries(pkg: ResolvedPackage, pkgInstalledDir: string, binDir: string, nodeModulesDir: string) {
  const bins: Record<string, string> = {};

  if (typeof pkg.bin === 'string') {
    bins[pkg.name] = pkg.bin;
  } else if (typeof pkg.bin === 'object' && pkg.bin !== null) {
    Object.assign(bins, pkg.bin);
  }

  const nodeExe = process.execPath;

  for (const [binName, relativeBinPath] of Object.entries(bins)) {
    const targetBinFile = path.resolve(pkgInstalledDir, relativeBinPath);

    if (process.platform === 'win32') {
      const cmdPath = path.join(binDir, `${binName}.cmd`);
      const ps1Path = path.join(binDir, `${binName}.ps1`);

      const cmdContent = `@IF EXIST "%~dp0\\node.exe" (\n  "%~dp0\\node.exe" "${targetBinFile}" %*\n) ELSE (\n  @SETLOCAL\n  @SET "NODE_PATH=${nodeModulesDir};%NODE_PATH%"\n  "${nodeExe}" "${targetBinFile}" %*\n)\n`;
      const ps1Content = `#!/usr/bin/env pwsh\n$env:NODE_PATH="${nodeModulesDir};$env:NODE_PATH"\n& "${nodeExe}" "${targetBinFile}" $args\n`;

      fs.writeFileSync(cmdPath, cmdContent, 'utf-8');
      fs.writeFileSync(ps1Path, ps1Content, 'utf-8');
    }

    const binSymlinkPath = path.join(binDir, binName);
    try {
      createSymlink(targetBinFile, binSymlinkPath, false);
    } catch {
      // Ignorujemy błędy
    }
  }
}
