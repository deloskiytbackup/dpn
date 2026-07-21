import semver from 'semver';
import { fetchPackageMetadata, NpmPackageVersion } from './registry.js';

export interface ResolvedPackage {
  name: string;
  version: string;
  tarballUrl: string;
  dependencies: Record<string, string>; // name -> resolved version
  rawDependencies: Record<string, string>; // name -> semver range
  bin?: Record<string, string> | string;
}

export type ResolvedTree = Map<string, ResolvedPackage>; // key: `${name}@${version}`

export async function resolveDependencies(
  rootDependencies: Record<string, string>,
  onResolvingPackage?: (name: string, range: string) => void
): Promise<{ tree: ResolvedTree; rootResolved: Record<string, string> }> {
  const tree: ResolvedTree = new Map();
  const rootResolved: Record<string, string> = {};
  const resolving = new Set<string>();

  async function resolvePackage(name: string, range: string): Promise<string> {
    if (onResolvingPackage) {
      onResolvingPackage(name, range);
    }

    const metadata = await fetchPackageMetadata(name);
    const availableVersions = Object.keys(metadata.versions);

    let targetVersion: string | null = null;

    if (metadata['dist-tags'] && metadata['dist-tags'][range]) {
      targetVersion = metadata['dist-tags'][range];
    } else {
      targetVersion = semver.maxSatisfying(availableVersions, range);
    }

    if (!targetVersion) {
      const cleanRange = range.replace(/[\^~=]/g, '').trim();
      targetVersion = semver.maxSatisfying(availableVersions, cleanRange);
    }

    if (!targetVersion) {
      targetVersion = metadata['dist-tags']?.['latest'] || availableVersions[availableVersions.length - 1];
    }

    if (!targetVersion) {
      throw new Error(`Nie znaleziono pasującej wersji dla paczki "${name}" z zakresem "${range}"`);
    }

    const key = `${name}@${targetVersion}`;

    if (tree.has(key)) {
      return targetVersion;
    }

    if (resolving.has(key)) {
      return targetVersion;
    }

    resolving.add(key);

    const versionData: NpmPackageVersion = metadata.versions[targetVersion];
    const rawDeps = versionData.dependencies || {};
    const resolvedDeps: Record<string, string> = {};

    const depPromises = Object.entries(rawDeps).map(async ([depName, depRange]) => {
      const depVer = await resolvePackage(depName, depRange);
      resolvedDeps[depName] = depVer;
    });

    await Promise.all(depPromises);

    tree.set(key, {
      name: versionData.name || name,
      version: targetVersion,
      tarballUrl: versionData.dist.tarball,
      dependencies: resolvedDeps,
      rawDependencies: rawDeps,
      bin: versionData.bin
    });

    resolving.delete(key);
    return targetVersion;
  }

  const rootPromises = Object.entries(rootDependencies).map(async ([name, range]) => {
    const ver = await resolvePackage(name, range);
    rootResolved[name] = ver;
  });

  await Promise.all(rootPromises);

  return { tree, rootResolved };
}
