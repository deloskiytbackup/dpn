import fs from 'node:fs';
import path from 'node:path';
import { resolveDependencies } from './resolver.js';
import { ensurePackagesInStoreParallel } from './store.js';
import { linkPackages } from './linker.js';
import { runScript } from './runner.js';
import { ProgressBar } from './ui.js';

const VERSION = '1.1.0';

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
    dependencies: {}
  };

  await fs.promises.writeFile(pkgPath, JSON.stringify(initialPkg, null, 2), 'utf-8');
  console.log(`[dpn] Utworzono plik package.json w ${projectDir}`);
}

async function handleInstall(projectDir: string) {
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

  console.log(`[dpn] Rozwiązywanie zależności dla ${depCount} pakietów nadrzędnych...`);
  const { tree, rootResolved } = await resolveDependencies(rootDeps);

  const packages = Array.from(tree.values());
  console.log(`[dpn] Znaleziono łącznie ${packages.length} unikalnych pakietów (z pod-zależnościami).\n`);

  const progressBar = new ProgressBar(packages.length);

  // Pobieramy i rozpakowujemy pakiety równolegle (pula 10 połączeń) z wizualizacją w czasie rzeczywistym
  await ensurePackagesInStoreParallel(packages, 10, (completed, total, pkg) => {
    progressBar.update(completed, `Pobieranie ${pkg.name}@${pkg.version}`);
  });

  progressBar.finish();

  // Tworzymy dowiązania (symlinks) w lokalnym node_modules
  await linkPackages(tree, rootResolved, projectDir);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✨ [dpn] Sukces! Zainstalowano i połączono ${packages.length} pakietów w ${duration}s.`);
}

async function handleAdd(pkgSpec: string, projectDir: string) {
  const pkgPath = path.join(projectDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    await handleInit(projectDir);
  }

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

  console.log(`[dpn] Dodawanie pakietu ${name}@${range} do package.json...`);

  const pkgJson = JSON.parse(await fs.promises.readFile(pkgPath, 'utf-8'));
  if (!pkgJson.dependencies) {
    pkgJson.dependencies = {};
  }

  pkgJson.dependencies[name] = range.startsWith('^') || range.startsWith('~') || range === 'latest' ? `^${range === 'latest' ? '0.0.0' : range.replace(/[\^~]/, '')}` : range;

  const { rootResolved } = await resolveDependencies({ [name]: range });
  if (rootResolved[name]) {
    pkgJson.dependencies[name] = `^${rootResolved[name]}`;
  }

  await fs.promises.writeFile(pkgPath, JSON.stringify(pkgJson, null, 2), 'utf-8');

  await handleInstall(projectDir);
}

function showHelp() {
  console.log(`
🚀 dpn (Direct Package Node) v${VERSION}
Autorski menedżer pakietów z obsługą dowiązań (symlinks) i globalnego store.

Użycie:
  dpn <command> [options]

Dostępne komendy:
  init               Tworzy nowy plik package.json
  install, i         Instaluje wszystkie zależności z package.json
  add <package>      Dodaje i instaluje pakiet (np. dpn add lodash)
  run <script>       Uruchamia skrypt zdefiniowany w package.json
  -v, --version      Wyświetla wersję dpn
  -h, --help         Wyświetla tę pomoc
`);
}

export async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const cwd = process.cwd();

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
        if (!args[1]) {
          console.error('Błąd: Podaj nazwę pakietu (np. dpn add lodash)');
          process.exit(1);
        }
        await handleAdd(args[1], cwd);
        break;
      case 'run':
        if (!args[1]) {
          console.error('Błąd: Podaj nazwę skryptu (np. dpn run build)');
          process.exit(1);
        }
        await runScript(args[1], cwd);
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
  } catch (err: any) {
    console.error(`\n❌ [dpn błąd]: ${err.message}`);
    process.exit(1);
  }
}
