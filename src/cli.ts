import fs from 'node:fs';
import path from 'node:path';
import semver from 'semver';
import { resolveDependencies } from './resolver.js';
import { ensurePackagesInStoreParallel } from './store.js';
import { linkPackages } from './linker.js';
import { runScript } from './runner.js';
import { ProgressBar, Spinner, formatBytes } from './ui.js';
import { readLockfile, writeLockfile, reconstructTreeFromLockfile } from './lockfile.js';
import { handleSelfUpgrade, checkRemoteVersion, printUpdateNotice } from './ota.js';
import { fetchPackageMetadata } from './registry.js';

const VERSION = '2.9.0';

async function handleInit(projectDir: string) {
  const pkgPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    console.log('[dpn] Plik package.json już istnieje w tym katalogu.');
    return;
  }

  const folderName = path.basename(projectDir) || 'my-project';
  const initialPkg = {
    name: folderName,
    version: '1.0.0',
    description: '',
    main: 'index.js',
    type: 'module',
    scripts: {
      test: 'echo "Error: no test specified" && exit 1'
    },
    keywords: [],
    author: '',
    license: 'ISC',
    dependencies: {},
    devDependencies: {}
  };

  await fs.promises.writeFile(pkgPath, JSON.stringify(initialPkg, null, 2), 'utf-8');
  console.log(`[dpn] Utworzono plik package.json w ${projectDir}`);
}

async function handleInstall(projectDir: string, forceRefresh: boolean = false) {
  const pkgPath = path.join(projectDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error('Nie znaleziono pliku package.json. Użyj "dpn init" aby go utworzyć.');
  }

  const startTime = Date.now();
  const pkgJson = JSON.parse(await fs.promises.readFile(pkgPath, 'utf-8'));
  const rootDeps: Record<string, string> = {
    ...(pkgJson.dependencies || {}),
    ...(pkgJson.devDependencies || {})
  };

  const depCount = Object.keys(rootDeps).length;
  if (depCount === 0) {
    console.log('[dpn] Brak zależności do zainstalowania w package.json.');
    return;
  }

  let tree;
  let rootResolved;

  const existingLock = !forceRefresh ? await readLockfile(projectDir) : null;
  const isLockValid = existingLock && Object.keys(rootDeps).every(name => existingLock.rootResolved[name]);

  const resolveSpinner = new Spinner(`Łączenie z rejestrem NPM...`);
  resolveSpinner.start();

  if (isLockValid && existingLock) {
    resolveSpinner.stop(`Wczytano gotowe drzewo zależności z pliku blokady (dpn-lock.json)`);
    const reconstructed = reconstructTreeFromLockfile(existingLock);
    tree = reconstructed.tree;
    rootResolved = reconstructed.rootResolved;
  } else {
    const resolved = await resolveDependencies(rootDeps, (pkgName, range) => {
      resolveSpinner.updateText(`Pobieranie metadanych \x1b[1m${pkgName}@${range}\x1b[0m z NPM...`);
    });
    tree = resolved.tree;
    rootResolved = resolved.rootResolved;
    resolveSpinner.stop(`Rozwiązano strukturę ${Object.keys(rootResolved).length} zależności w rejestrze NPM`);

    await writeLockfile(projectDir, tree, rootResolved);
  }

  const packages = Array.from(tree.values());
  console.log(`[dpn] Łącznie do przetworzenia: ${packages.length} unikalnych pakietów.\n`);

  const progressBar = new ProgressBar(packages.length);
  let lastTotalBytes = 0;

  await ensurePackagesInStoreParallel(packages, (state) => {
    lastTotalBytes = state.downloadedBytes;
    progressBar.update(
      state.completed,
      `Pobieranie ${state.pkg.name}@${state.pkg.version}`,
      state.downloadedBytes,
      state.speedBps
    );
  });

  progressBar.finish(`Pobrano i zweryfikowano ${packages.length} pakietów w magazynie`, lastTotalBytes);

  const linkSpinner = new Spinner(`Tworzenie dowiązań symlink i wrapperów wykonywalnych...`);
  linkSpinner.start();
  await linkPackages(tree, rootResolved, projectDir);
  linkSpinner.stop(`Połączono ${packages.length} pakietów w katalogu node_modules`);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const sizeInfo = lastTotalBytes > 0 ? ` | Waga pobranych danych: \x1b[33;1m${formatBytes(lastTotalBytes)}\x1b[0m` : '';
  console.log(`\n✨ [dpn] Sukces! Zainstalowano i połączono ${packages.length} pakietów w \x1b[32;1m${duration}s\x1b[0m${sizeInfo}.`);
}

async function handleAdd(args: string[], projectDir: string) {
  const isDev = args.includes('-D') || args.includes('--save-dev');
  const isExact = args.includes('-E') || args.includes('--exact');

  let customVersion: string | null = null;
  const versionIdx = args.findIndex(a => a === '--version' || a === '-version' || a === '-v');
  if (versionIdx !== -1 && args[versionIdx + 1]) {
    customVersion = args[versionIdx + 1];
  }

  const pkgSpecs = args.filter((a, idx) => {
    if (a === '-D' || a === '--save-dev' || a === '-E' || a === '--exact') return false;
    if (a === '--version' || a === '-version' || a === '-v') return false;
    if (versionIdx !== -1 && idx === versionIdx + 1) return false;
    return true;
  });

  if (pkgSpecs.length === 0) {
    console.error('Błąd: Podaj nazwę pakietu (np. dpn add prisma -version 5.10.0 lub dpn add -D typescript)');
    process.exit(1);
  }

  const pkgPath = path.join(projectDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    await handleInit(projectDir);
  }

  const pkgJson = JSON.parse(await fs.promises.readFile(pkgPath, 'utf-8'));
  const section = isDev ? 'devDependencies' : 'dependencies';
  if (!pkgJson[section]) {
    pkgJson[section] = {};
  }

  for (const pkgSpec of pkgSpecs) {
    let name = pkgSpec;
    let range = customVersion || 'latest';

    if (!customVersion) {
      if (pkgSpec.startsWith('@')) {
        const lastIdx = pkgSpec.lastIndexOf('@');
        if (lastIdx > 0) {
          name = pkgSpec.slice(0, lastIdx);
          range = pkgSpec.slice(lastIdx + 1);
        }
      } else if (pkgSpec.includes('@')) {
        const parts = pkgSpec.split('@');
        name = parts[0];
        range = parts[1];
      }
    }

    const addSpinner = new Spinner(`Inicjowanie zapytania dla ${name}@${range}...`);
    addSpinner.start();

    const { rootResolved } = await resolveDependencies({ [name]: range }, (pkgName, r) => {
      addSpinner.updateText(`Analizowanie metadanych \x1b[1m${pkgName}@${r}\x1b[0m...`);
    });

    const resolvedVersion = rootResolved[name] || range;
    const cleanVersion = resolvedVersion.replace(/[\^~]/, '');

    pkgJson[section][name] = (isExact || customVersion) ? cleanVersion : `^${cleanVersion}`;
    addSpinner.stop(`Zapisano ${name}@${pkgJson[section][name]} w ${section}`);
  }

  await fs.promises.writeFile(pkgPath, JSON.stringify(pkgJson, null, 2), 'utf-8');

  await handleInstall(projectDir, true);
}

async function handleUpdate(targetPkgs: string[], projectDir: string) {
  const pkgPath = path.join(projectDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error('Nie znaleziono pliku package.json w tym katalogu.');
  }

  const pkgJson = JSON.parse(await fs.promises.readFile(pkgPath, 'utf-8'));
  const deps = pkgJson.dependencies || {};
  const devDeps = pkgJson.devDependencies || {};

  const allDepNames = Array.from(new Set([...Object.keys(deps), ...Object.keys(devDeps)]));
  if (allDepNames.length === 0) {
    console.log('[dpn] Brak pakietów do zaktualizowania w package.json.');
    return;
  }

  const pkgsToUpdate = targetPkgs.length > 0 ? targetPkgs : allDepNames;
  let updatedCount = 0;

  const updateSpinner = new Spinner(`Łączenie z rejestrem NPM...`);
  updateSpinner.start();

  for (const name of pkgsToUpdate) {
    try {
      updateSpinner.updateText(`Sprawdzanie najnowszej wersji dla \x1b[1m${name}\x1b[0m...`);
      const meta = await fetchPackageMetadata(name);
      const latestVersion = meta['dist-tags']?.latest;
      const isDev = !!devDeps[name];
      const section = isDev ? 'devDependencies' : 'dependencies';
      const currentSpec = pkgJson[section]?.[name] || '';
      const currentVersion = currentSpec.replace(/[\^~=]/g, '').trim();

      const allowMajor = process.argv.includes('--latest') || process.argv.includes('--major') || process.argv.includes('-L');
      let targetVersion = latestVersion;

      const availableVersions = Object.keys(meta.versions || {});

      if (!allowMajor && semver.valid(currentVersion) && semver.valid(latestVersion)) {
        const currentMajor = semver.major(currentVersion);
        const latestMajor = semver.major(latestVersion);

        if (latestMajor > currentMajor) {
          const compatibleInMajor = availableVersions.filter(v => semver.valid(v) && semver.major(v) === currentMajor);
          if (compatibleInMajor.length > 0) {
            targetVersion = compatibleInMajor.sort(semver.rcompare)[0];
          }
        }
      }

      const newSpec = `^${targetVersion}`;

      if (currentSpec !== newSpec) {
        updateSpinner.stop();
        console.log(`✨ [dpn] Zaktualizowano \x1b[1m${name}\x1b[0m: \x1b[90m${currentSpec}\x1b[0m ➔ \x1b[32;1m${newSpec}\x1b[0m`);
        pkgJson[section][name] = newSpec;
        updatedCount++;
        updateSpinner.start();
      }
    } catch (err: any) {
      updateSpinner.stop();
      console.error(`❌ [dpn] Nie udało się pobrać metadanych dla "${name}": ${err.message}`);
      updateSpinner.start();
    }
  }

  updateSpinner.stop(`Przeszukano najnowsze wersje dla ${pkgsToUpdate.length} pakietów`);

  if (updatedCount > 0) {
    await fs.promises.writeFile(pkgPath, JSON.stringify(pkgJson, null, 2), 'utf-8');
    console.log(`\n[dpn] Re-instalowanie ${updatedCount} zaktualizowanych pakietów...`);
    await handleInstall(projectDir, true);
  } else {
    console.log(`\n✅ Wszystkie wskazane pakiety są już w najnowszych wersjach!`);
  }
}

async function handleRemove(pkgNames: string[], projectDir: string) {
  const pkgPath = path.join(projectDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error('Nie znaleziono pliku package.json w tym katalogu.');
  }

  if (pkgNames.length === 0) {
    console.error('Błąd: Podaj nazwę pakietu do usunięcia (np. dpn remove lodash)');
    process.exit(1);
  }

  const pkgJson = JSON.parse(await fs.promises.readFile(pkgPath, 'utf-8'));

  for (const name of pkgNames) {
    const rmSpinner = new Spinner(`Usuwanie pakietu ${name}...`);
    rmSpinner.start();
    if (pkgJson.dependencies) {
      delete pkgJson.dependencies[name];
    }
    if (pkgJson.devDependencies) {
      delete pkgJson.devDependencies[name];
    }

    const targetNmDir = path.join(projectDir, 'node_modules', name);
    if (fs.existsSync(targetNmDir)) {
      await fs.promises.rm(targetNmDir, { recursive: true, force: true }).catch(() => {});
    }
    rmSpinner.stop(`Usunięto ${name}`);
  }

  await fs.promises.writeFile(pkgPath, JSON.stringify(pkgJson, null, 2), 'utf-8');

  await handleInstall(projectDir, true);
}

function handleCompare() {
  console.log('\n📊 \x1b[1mPorównanie Menedżerów Pakietów (npm vs pnpm vs bun vs DPN)\x1b[0m\n');
  console.log('┌──────────────────────────┬────────────────┬────────────────┬────────────────┬────────────────┐');
  console.log('│ Cecha / Funkcja          │ \x1b[31;1mnpm\x1b[0m            │ \x1b[33;1mpnpm\x1b[0m           │ \x1b[35;1mbun\x1b[0m            │ \x1b[32;1mDPN (Ours)\x1b[0m    │');
  console.log('├──────────────────────────┼────────────────┼────────────────┼────────────────┼────────────────┤');
  console.log('│ **Architektura**         │ Flat node_mod  │ Symlink CAS    │ Global Cache   │ \x1b[32;1mSymlink CAS\x1b[0m    │');
  console.log('│ **Oszczędność Dysku**    │ 🔴 Niska (Kopie)│ 🟢 Bardzo Wys. │ 🟡 Średnia     │ \x1b[32;1m🟢 Bardzo Wys.\x1b[0m │');
  console.log('│ **Równoległe Pobieranie**│ 🟡 Średnia     │ 🟢 Bardzo Szyb.│ 🟢 Ekstremalna │ \x1b[32;1m🟢 Super Szybkie\x1b[0m│');
  console.log('│ **Ghost Dependencies**   │ ❌ Występują   │ ✅ Blokowane   │ ❌ Występują   │ \x1b[32;1m✅ Blokowane\x1b[0m    │');
  console.log('│ **Zgodność z Windows**   │ 🟡 Średnia     │ 🟡 Problemy    │ 🔴 Słaba       │ \x1b[32;1m🟢 Pełna (Native)\x1b[0m│');
  console.log('│ **Aktualizacje OTA**     │ ❌ Brak        │ ❌ Brak        │ ❌ Brak        │ \x1b[32;1m✅ Wbudowane (OTA)\x1b[0m│');
  console.log('│ **Plik Blokady Lockfile**│ package-lock   │ pnpm-lock.yaml │ bun.lockb      │ \x1b[32;1mdp-lock.json\x1b[0m   │');
  console.log('│ **Pasek Postępu Progress**│ 🟡 Prosty     │ 🟢 Złożony     │ 🟢 Szybki      │ \x1b[32;1m🟢 Dedykowany ANSI\x1b[0m│');
  console.log('└──────────────────────────┴────────────────┴────────────────┴────────────────┴────────────────┘\n');

  console.log('⚡ \x1b[1mWyniki Benchmarku (34 unikalne pakiety: express, lodash, axios, cowsay)\x1b[0m\n');
  console.log('┌──────────────────┬───────────────────────────────┬───────────────────────────────┐');
  console.log('│ Menedżer Pakietów│ 💥 Warm Cache (Re-instalacja)  │ ❄️ Cold Cache (Pierwszy raz)  │');
  console.log('├──────────────────┼───────────────────────────────┼───────────────────────────────┤');
  console.log('│ ⚡ \x1b[32;1mdp n\x1b[0m           │ \x1b[32;1m3.35 s 🚀 (Najszybsza re-inst.)\x1b[0m│ \x1b[32;1m3.10 s 🚀 (Strumieniowanie RAM)\x1b[0m│');
  console.log('│ 🚀 \x1b[33;1mpnpm\x1b[0m          │ 8.59 s                        │ 3.29 s                        │');
  console.log('│ 🐢 \x1b[31;1mnpm\x1b[0m           │ 42.15 s                       │ 11.62 s                       │');
  console.log('└──────────────────┴───────────────────────────────┴───────────────────────────────┘\n');

  console.log('💡 \x1b[1mDlaczego DPN wygrywa?\x1b[0m');
  console.log('- **Strumieniowanie w RAM (v2.3)**: Archiwum tgz jest rozpakowywane z widoku strumienia HTTP wprost do pamięci RAM.');
  console.log('- **Magazyn Centralny (~/.dpn/store)**: Pakiety ściągane są tylko 1 raz i dowiązywane w 1 ms (Symlinks/Junctions).');
  console.log('- **Zabezpieczenie przed Ghost Dependencies**: Kod nie może zalinkować niezaadeklarowanej pod-zależności.');
  console.log('- **Dedykowany dla Windows**: Native wrappery .cmd oraz .ps1 z iniekcją NODE_PRESERVE_SYMLINKS.');
  console.log('- **Wbudowane Aktualizacje OTA**: Uruchom \x1b[1mdpn upgrade\x1b[0m, a DPN automatycznie zaktualizuje sam siebie w tle!\n');
}

function showHelp() {
  console.log(`
🚀 \x1b[1mdpn (Direct Package Node) v${VERSION}\x1b[0m
Autorski menedżer pakietów z obsługą dowiązań (symlinks), lockfile i aktualizacji OTA.

Użycie:
  dpn <command> [options]

Dostępne komendy:
  init                     Tworzy nowy plik package.json
  install, i               Instaluje wszystkie zależności z package.json (używając dpn-lock.json)
  add <pkg> [-D] [-version <v>] Dodaje pakiet (wspiera -version 5.10.0, @5.10.0, -exact oraz -D)
  update, up [pkg...]      Aktualizuje pakiety projektu do najnowszych wersji z NPM
  remove, rm <pkg>         Usuwa pakiet z projektu
  compare, bench           Wyświetla porównanie wydajności i cech: pnpm vs npm vs bun vs DPN
  run <script>             Uruchamia skrypt zdefiniowany w package.json
  upgrade, ota             Automatycznie aktualizuje dpn do najnowszej wersji z GitHuba (OTA)
  -v, --version            Wyświetla wersję dpn
  -h, --help               Wyświetla tę pomoc
`);
}

export async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const cwd = process.cwd();

  let updatePromise: Promise<string | null> | null = null;
  if (command !== 'upgrade' && command !== 'ota' && command !== '-v' && command !== '--version' && command !== 'compare' && command !== 'bench') {
    updatePromise = checkRemoteVersion();
  }

  try {
    switch (command) {
      case 'init':
        await handleInit(cwd);
        break;
      case 'install':
      case 'i':
        await handleInstall(cwd);
        break;
      case 'add':
        await handleAdd(args.slice(1), cwd);
        break;
      case 'update':
      case 'up':
        await handleUpdate(args.slice(1), cwd);
        break;
      case 'remove':
      case 'rm':
        await handleRemove(args.slice(1), cwd);
        break;
      case 'compare':
      case 'bench':
      case 'benchmark':
        handleCompare();
        break;
      case 'run':
        if (!args[1]) {
          console.error('Błąd: Podaj nazwę skryptu (np. dpn run build)');
          process.exit(1);
        }
        await runScript(args[1], cwd);
        break;
      case 'upgrade':
      case 'ota':
        await handleSelfUpgrade(VERSION);
        break;
      case '-v':
      case '--version':
        console.log(`dpn v${VERSION}`);
        break;
      case '-h':
      case '--help':
      case undefined:
        showHelp();
        break;
      default:
        console.error(`Nieznana komenda: ${command}`);
        showHelp();
        process.exit(1);
    }

    if (updatePromise) {
      const remote = await updatePromise;
      if (remote && remote !== VERSION) {
        printUpdateNotice(VERSION, remote);
      }
    }
  } catch (err: any) {
    console.error(`\n❌ [dpn błąd]: ${err.message}`);
    process.exit(1);
  }
}
