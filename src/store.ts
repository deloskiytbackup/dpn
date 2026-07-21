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
  const safeName = name.replace(/\//g, '+');
  return path.join(STORE_DIR, `${safeName}@${version}`);
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
let startTime = 0;

class ConcurrencyPool {
  private active = 0;
  private queue: (() => void)[] = [];

  constructor(private limit: number = 16) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) next();
      }
    }
  }
}

export async function ensurePackageInStore(
  pkg: ResolvedPackage,
  onProgress?: (bytes: number) => void
): Promise<string> {
  const storePath = getPackageStorePath(pkg.name, pkg.version);

  if (fs.existsSync(path.join(storePath, 'package.json'))) {
    return storePath;
  }

  await fs.promises.mkdir(storePath, { recursive: true });

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(pkg.tarballUrl);
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status} dla ${pkg.tarballUrl}`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        globalTotalBytes += parseInt(contentLength, 10);
      }

      const nodeStream = Readable.fromWeb(response.body as any);

      nodeStream.on('data', (chunk: Buffer) => {
        globalDownloadedBytes += chunk.length;
        if (onProgress) {
          onProgress(chunk.length);
        }
      });

      await finished(
        nodeStream.pipe(
          tar.x({
            cwd: storePath,
            strip: 1
          })
        )
      );

      return storePath;
    } catch (err: any) {
      if (attempt === 3) {
        await fs.promises.rm(storePath, { recursive: true, force: true }).catch(() => {});
        throw new Error(`Błąd pobierania pakietu ${pkg.name}@${pkg.version}: ${err.message}`);
      }
      await new Promise(r => setTimeout(r, 400 * attempt));
    }
  }

  return storePath;
}

export async function ensurePackagesInStoreParallel(
  pkgs: ResolvedPackage[],
  onProgress?: (state: ProgressState) => void
): Promise<{ downloadedBytes: number; speedBps: number }> {
  const pool = new ConcurrencyPool(16);
  let completed = 0;
  globalDownloadedBytes = 0;
  globalTotalBytes = 0;
  startTime = Date.now();

  const tasks = pkgs.map(pkg =>
    pool.run(async () => {
      await ensurePackageInStore(pkg, () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const speedBps = elapsed > 0 ? globalDownloadedBytes / elapsed : 0;
        if (onProgress) {
          onProgress({
            completed,
            total: pkgs.length,
            pkg,
            downloadedBytes: globalDownloadedBytes,
            totalBytes: globalTotalBytes,
            speedBps
          });
        }
      });
      completed++;
      const elapsed = (Date.now() - startTime) / 1000;
      const speedBps = elapsed > 0 ? globalDownloadedBytes / elapsed : 0;
      if (onProgress) {
        onProgress({
          completed,
          total: pkgs.length,
          pkg,
          downloadedBytes: globalDownloadedBytes,
          totalBytes: globalTotalBytes,
          speedBps
        });
      }
    })
  );

  await Promise.all(tasks);

  const totalElapsed = (Date.now() - startTime) / 1000;
  const finalSpeedBps = totalElapsed > 0 ? globalDownloadedBytes / totalElapsed : 0;

  return {
    downloadedBytes: globalDownloadedBytes,
    speedBps: finalSpeedBps
  };
}
