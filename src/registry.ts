import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

export interface NpmPackageVersion {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  dist: {
    tarball: string;
    shasum?: string;
    integrity?: string;
  };
  bin?: Record<string, string> | string;
}

export interface NpmPackageMetadata {
  name: string;
  'dist-tags': Record<string, string>;
  versions: Record<string, NpmPackageVersion>;
}

const metadataCache = new Map<string, NpmPackageMetadata>();
const REGISTRY_URL = 'https://registry.npmjs.org';

export async function fetchPackageMetadata(packageName: string): Promise<NpmPackageMetadata> {
  if (metadataCache.has(packageName)) {
    return metadataCache.get(packageName)!;
  }

  // Handle scoped packages: @foo/bar -> %2F
  const encodedName = packageName.startsWith('@')
    ? `@${encodeURIComponent(packageName.slice(1))}`
    : encodeURIComponent(packageName);

  const url = `${REGISTRY_URL}/${encodedName}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*'
    }
  });

  if (!response.ok) {
    throw new Error(`Nie udało się pobrać metadanych dla pakietu "${packageName}": HTTP ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as NpmPackageMetadata;
  metadataCache.set(packageName, data);
  return data;
}

export async function downloadTarball(tarballUrl: string, destPath: string): Promise<void> {
  const response = await fetch(tarballUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Błąd podczas pobierania archiwum z ${tarballUrl}: HTTP ${response.status}`);
  }

  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  const fileStream = fs.createWriteStream(destPath);
  
  // Convert web ReadableStream to Node Readable
  const nodeStream = Readable.fromWeb(response.body as any);
  await finished(nodeStream.pipe(fileStream));
}
