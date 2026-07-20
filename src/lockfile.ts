import fs from 'node:fs';
import path from 'node:path';
import { ResolvedPackage, ResolvedTree } from './resolver.js';

export interface LockfileData {
  lockfileVersion: number;
  rootResolved: Record<string, string>;
  packages: Record<string, {
    name: string;
    version: string;
    tarballUrl: string;
    dependencies: Record<string, string>;
    rawDependencies: Record<string, string>;
    bin?: Record<string, string> | string;
  }>;
}

const LOCKFILE_NAME = 'dpn-lock.json';

export function getLockfilePath(projectDir: string): string {
  return path.join(projectDir, LOCKFILE_NAME);
}

export async function readLockfile(projectDir: string): Promise<LockfileData | null> {
  const filePath = getLockfilePath(projectDir);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content) as LockfileData;
  } catch {
    return null;
  }
}

export async function writeLockfile(
  projectDir: string,
  tree: ResolvedTree,
  rootResolved: Record<string, string>
): Promise<void> {
  const filePath = getLockfilePath(projectDir);
  const lockData: LockfileData = {
    lockfileVersion: 1,
    rootResolved,
    packages: {}
  };

  for (const [key, pkg] of tree.entries()) {
    lockData.packages[key] = {
      name: pkg.name,
      version: pkg.version,
      tarballUrl: pkg.tarballUrl,
      dependencies: pkg.dependencies,
      rawDependencies: pkg.rawDependencies,
      bin: pkg.bin
    };
  }

  await fs.promises.writeFile(filePath, JSON.stringify(lockData, null, 2), 'utf-8');
}

export function reconstructTreeFromLockfile(lockData: LockfileData): {
  tree: ResolvedTree;
  rootResolved: Record<string, string>;
} {
  const tree: ResolvedTree = new Map();

  for (const [key, pkg] of Object.entries(lockData.packages)) {
    tree.set(key, {
      name: pkg.name,
      version: pkg.version,
      tarballUrl: pkg.tarballUrl,
      dependencies: pkg.dependencies,
      rawDependencies: pkg.rawDependencies,
      bin: pkg.bin
    });
  }

  return { tree, rootResolved: lockData.rootResolved };
}
