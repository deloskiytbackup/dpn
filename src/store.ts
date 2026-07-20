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

export interface ProgressState {
  completed: number;
  total: number;
  pkg: ResolvedPackage;
  downloadedBytes: number;
  totalBytes: number;
  speedBps: number;
}

let globalDownloadedBytes = 0;
let globalTotalBytes = 0;
const startTimeMs = Date.now();

export async function ensurePackageInStore(
  pkg: ResolvedPackage,
  onChunk?: (bytesRead: number) => void
): Promise<string> {
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

  const contentLength = response.headers.get('content-length');
  if (contentLength) {
    globalTotalBytes += parseInt(contentLength, 10);
  }

  const reader = response.body.getReader();
  const trackingStream = new ReadableStream({
    async start(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          break;
        }
        if (value) {
          globalDownloadedBytes += value.byteLength;
          if (onChunk) onChunk(value.byteLength);
          controller.enqueue(value);
        }
      }
    }
  });

  const tarStream = tar.x({
    cwd: targetDir,
    strip: 1
  });

  const nodeStream = Readable.fromWeb(trackingStream as any);
  await finished(nodeStream.pipe(tarStream));

  return targetDir;
}

export async function ensurePackagesInStoreParallel(
  packages: ResolvedPackage[],
  concurrency: number = 16,
  onProgress?: (state: ProgressState) => void
): Promise<void> {
  const total = packages.length;
  let completed = 0;
  let index = 0;
  globalDownloadedBytes = 0;
  globalTotalBytes = 0;
  const startMs = Date.now();

  function notifyProgress(pkg: ResolvedPackage) {
    if (!onProgress) return;
    const elapsedSec = Math.max((Date.now() - startMs) / 1000, 0.1);
    const speedBps = globalDownloadedBytes / elapsedSec;
    onProgress({
      completed,
      total,
      pkg,
      downloadedBytes: globalDownloadedBytes,
      totalBytes: globalTotalBytes,
      speedBps
    });
  }

  async function worker() {
    while (index < packages.length) {
      const i = index++;
      const pkg = packages[i];
      await ensurePackageInStore(pkg, () => {
        notifyProgress(pkg);
      });
      completed++;
      notifyProgress(pkg);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, packages.length) }, () => worker());
  await Promise.all(workers);
}
