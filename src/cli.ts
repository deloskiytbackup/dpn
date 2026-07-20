import fs from 'node:fs';
import path from 'node:path';
import { resolveDependencies } from './resolver.js';
import { ensurePackagesInStoreParallel } from './store.js';
import { linkPackages } from './linker.js';
import { runScript } from './runner.js';
import { ProgressBar } from './ui.js';
import { readLockfile, writeLockfile, reconstructTreeFromLockfile } from './lockfile.js';
import { handleSelfUpgrade, checkRemoteVersion, printUpdateNotice } from './ota.js';

const VERSION = '1.4.0';

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

  if (isLockValid && existingLock) {
    console.log('[dpn] Używanie pliku blokady (dpn-lock.json)...');
    const reconstructed = reconstructTreeFromLockfile(existingLock);
    tree = reconstructed.tree;
    rootResolved = reconstructed.rootResolved;
  } else {
    console.log(`[dpn] Rozwiązywanie zależności dla ${depCount} pakietów nadrzędnych...`);
    const resolved = await resolveDependencies(rootDeps);
    tree = resolved.tree;
    rootResolved = resolved.rootResolved;

    await writeLockfile(projectDir, tree, rootResolved);
  }

  const packages = Array.from(tree.values());
  console.log(`[dpn] Znaleziono łącznie ${packages.length} unikalnych pakietów (z pod-zależnościami).\n`);

  const progressBar = new ProgressBar(packages.length);

  await ensurePackagesInStoreParallel(packages, 10, (completed, total, pkg) => {
    progressBar.update(completed, `Pobieranie ${pkg.name}@${pkg.version}`);
  });

  progressBar.finish();

  await linkPackages(tree, rootResolved, projectDir);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✨ [dpn] Sukces! Zainstalowano i połączono ${packages.length} pakietów w ${duration}s.`);
}

async function handleAdd(args: string[], projectDir: string) {
  const isDev = args.includes('-D') || args.includes('--save-dev');
  const pkgSpecs = args.filter(a => a !== '-D' && a !== '--save-dev' && !a.startsWith('-'));

  if (pkgSpecs.length === 0) {
    console.error('Błąd: Podaj nazwę pakietu (np. dpn add lodash lub dpn add -D typescript)');
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
    let range = 'latest';

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

    console.log(`[dpn] Dodawanie pakietu ${name}@${range} do ${section}...`);
    const { rootResolved } = await resolveDependencies({ [name]: range });
    const resolvedVersion = rootResolved[name] || range;
    pkgJson[section][name] = `^${resolvedVersion.replace(/[\^~]/, '')}`;
  }

  await fs.promises.writeFile(pkgPath, JSON.stringify(pkgJson, null, 2), 'utf-8');

  await handleInstall(projectDir, true);
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
    console.log(`[dpn] Usuwanie pakietu ${name}...`);
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
  }

  await fs.promises.writeFile(pkgPath, JSON.stringify(pkgJson, null, 2), 'utf-8');

  await handleInstall(projectDir, true);
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
  add <pkg> [-D]           Dodaje pakiet do dependencies (lub devDependencies z flagą -D)
  remove, rm <pkg>         Usuwa pakiet z projektu
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

  // Sprawdzenie nowej wersji w tle dla poleceń (z wyjątkiem polecenia upgrade)
  let updatePromise: Promise<string | null> | null = null;
  if (command !== 'upgrade' && command !== 'ota' && command !== '-v' && command !== '--version') {
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
      case 'remove':
      case 'rm':
        await handleRemove(args.slice(1), cwd);
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
