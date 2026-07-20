import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import * as tar from 'tar';
import { ResolvedPackage } from './resolver.js';

const DPN_HOME = path.join(os.homedir(), '.dpn');
const STORE_DIR = path.join(DPN_HOME, 'store');

export function getStoreDir(): string {
  return STORE_DIR;
}

export function getPackageStorePath(name: string, version: string): string {
  return path.join(STORE_DIR, name, version);
}

// Błyskawiczne pobieranie i rozpakowywanie w pamięci RAM bez zapisywania plików tymczasowych tgz na dysku
export async function ensurePackageInStore(pkg: ResolvedPackage): Promise<string> {
  const targetDir = getPackageStorePath(pkg.name, pkg.version);
  const packageJsonPath = path.join(targetDir, 'package.json');

  if (fs.existsSync(packageJsonPath)) {
    return targetDir;
  }

  await fs.promises.mkdir(targetDir, { recursive: true });

  let response: Response | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      response = await fetch(pkg.tarballUrl);
      if (response.ok && response.body) break;
    } catch {
      if (attempt === 3) throw new Error(`Nie udało się połączyć z ${pkg.tarballUrl}`);
      await new Promise(r => setTimeout(r, 300 * attempt));
    }
  }

  if (!response || !response.ok || !response.body) {
    throw new Error(`Nie udało się pobrać archiwum ${pkg.name}@${pkg.version}`);
  }

  const tarStream = tar.x({
    cwd: targetDir,
    strip: 1
  });

  const nodeStream = Readable.fromWeb(response.body as any);
  await finished(nodeStream.pipe(tarStream));

  return targetDir;
}

export async function ensurePackagesInStoreParallel(
  packages: ResolvedPackage[],
  concurrency: number = 16,
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
