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

  const safeFileName = `${pkg.name.replace('/', '__')}-${pkg.version}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.tgz`;
  const tmpTarballPath = path.join(TMP_DIR, safeFileName);

  await downloadTarball(pkg.tarballUrl, tmpTarballPath);

  await tar.x({
    file: tmpTarballPath,
    cwd: targetDir,
    strip: 1
  });

  await fs.promises.unlink(tmpTarballPath).catch(() => {});

  return targetDir;
}

export async function ensurePackagesInStoreParallel(
  packages: ResolvedPackage[],
  concurrency: number = 8,
  onProgress?: (completed: number, total: number, pkg: ResolvedPackage) => void
): Promise<void> {
  const total = packages.length;
  let completed = 0;
  let index = 0;

  async function worker() {
    while (index < packages.length) {
      const i = index++;
      const pkg = packages[i];
      await ensurePackageInStore(pkg);
      completed++;
      if (onProgress) {
        onProgress(completed, total, pkg);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, packages.length) }, () => worker());
  await Promise.all(workers);
}
