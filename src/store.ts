import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as tar from 'tar';
import { downloadTarball } from './registry.js';
import { ResolvedPackage } from './resolver.js';

const DPN_HOME = path.join(os.homedir(), '.dpn');
const STORE_DIR = path.join(DPN_HOME, 'store');
const TMP_DIR = path.join(DPN_HOME, 'tmp');

export function getStoreDir(): string {
  return STORE_DIR;
}

export function getPackageStorePath(name: string, version: string): string {
  // Dla scoped packages, np. @types/node -> @types/node
  return path.join(STORE_DIR, name, version);
}

export async function ensurePackageInStore(pkg: ResolvedPackage): Promise<string> {
  const targetDir = getPackageStorePath(pkg.name, pkg.version);
  const packageJsonPath = path.join(targetDir, 'package.json');

  if (fs.existsSync(packageJsonPath)) {
    return targetDir;
  }

  await fs.promises.mkdir(targetDir, { recursive: true });
  await fs.promises.mkdir(TMP_DIR, { recursive: true });

  const safeFileName = `${pkg.name.replace('/', '__')}-${pkg.version}.tgz`;
  const tmpTarballPath = path.join(TMP_DIR, safeFileName);

  console.log(`[dpn store] Pobieranie ${pkg.name}@${pkg.version}...`);
  await downloadTarball(pkg.tarballUrl, tmpTarballPath);

  // Rozpakowywanie archiwum tarball (strip: 1 usuwa pierwszą warstwę "package/")
  await tar.x({
    file: tmpTarballPath,
    cwd: targetDir,
    strip: 1
  });

  // Usuwamy tymczasowy plik .tgz
  await fs.promises.unlink(tmpTarballPath).catch(() => {});

  return targetDir;
}
