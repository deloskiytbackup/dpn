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
  rootDependencies: Record<string, string>
): Promise<{ tree: ResolvedTree; rootResolved: Record<string, string> }> {
  const tree: ResolvedTree = new Map();
  const rootResolved: Record<string, string> = {};
  const resolving = new Set<string>();

  async function resolvePackage(name: string, range: string): Promise<string> {
    const metadata = await fetchPackageMetadata(name);
    const availableVersions = Object.keys(metadata.versions);

    let targetVersion: string | null = null;

    if (metadata['dist-tags'] && metadata['dist-tags'][range]) {
      targetVersion = metadata['dist-tags'][range];
    } else {
      targetVersion = semver.maxSatisfying(availableVersions, range);
    }

    if (!targetVersion) {
      // Fallback: search for latest available or exact match
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
      // Cykliczna zależność - zapobiegamy zapętleniu
      return targetVersion;
    }

    resolving.add(key);

    const versionData: NpmPackageVersion = metadata.versions[targetVersion];
    const rawDeps = versionData.dependencies || {};
    const resolvedDeps: Record<string, string> = {};

    // Rekurencyjnie rozwiązujemy zależności tej paczki
    for (const [depName, depRange] of Object.entries(rawDeps)) {
      const resolvedDepVersion = await resolvePackage(depName, depRange);
      resolvedDeps[depName] = resolvedDepVersion;
    }

    tree.set(key, {
      name,
      version: targetVersion,
      tarballUrl: versionData.dist.tarball,
      dependencies: resolvedDeps,
      rawDependencies: rawDeps,
      bin: versionData.bin
    });

    resolving.delete(key);
    return targetVersion;
  }

  for (const [name, range] of Object.entries(rootDependencies)) {
    const resolvedVersion = await resolvePackage(name, range);
    rootResolved[name] = resolvedVersion;
  }

  return { tree, rootResolved };
}
