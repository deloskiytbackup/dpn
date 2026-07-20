import https from 'node:https';
import child_process from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';

export async function checkRemoteVersion(): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/deloskiytbackup/dpn/main/package.json?t=${Date.now()}`;

  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 2000 }, (res) => {
      if (res.statusCode !== 200) {
        resolve(null);
        return;
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const pkg = JSON.parse(body);
          resolve(pkg.version || null);
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

export async function handleSelfUpgrade(currentVersion: string) {
  console.log('🔄 [dpn OTA] Sprawdzanie dostępności aktualizacji na GitHubie...');
  const remoteVersion = await checkRemoteVersion();

  if (!remoteVersion) {
    console.log('❌ [dpn OTA] Nie udało się połączyć z serwerem aktualizacji GitHub.');
    return;
  }

  // Porównujemy semwerowo, czy nowa wersja z GitHuba jest większa od aktualnej
  if (!semver.gt(remoteVersion, currentVersion)) {
    console.log(`✅ [dpn OTA] Posiadasz już najnowszą wersję dpn v${currentVersion}!`);
    return;
  }

  console.log(`\n🚀 Znaleziono nową wersję: \x1b[32;1mv${remoteVersion}\x1b[0m (Obecna: v${currentVersion})`);
  console.log('📦 [dpn OTA] Rozpoczynam automatyczną aktualizację Over-The-Air...\n');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dpnRepoDir = path.resolve(__dirname, '..');

  try {
    console.log('⬇️  1/3 Pobieranie najnowszego kodu z GitHuba...');
    child_process.execSync('git pull origin main', { cwd: dpnRepoDir, stdio: 'inherit' });

    console.log('\n🔨 2/3 Kompilacja projektu TypeScript...');
    child_process.execSync('npm run build', { cwd: dpnRepoDir, stdio: 'inherit' });

    console.log('\n🔗 3/3 Aktualizacja globalnego dowiązania wykonywalnego...');
    child_process.execSync('npm link', { cwd: dpnRepoDir, stdio: 'inherit' });

    console.log(`\n✨ [dpn OTA] Sukces! Pomyślnie zaktualizowano dpn do wersji \x1b[32;1mv${remoteVersion}\x1b[0m! 🎉\n`);
  } catch (err: any) {
    console.error(`\n❌ [dpn OTA błąd]: Nie udało się dokonać automatycznej aktualizacji: ${err.message}`);
  }
}

export function printUpdateNotice(currentVersion: string, remoteVersion: string) {
  if (remoteVersion && semver.gt(remoteVersion, currentVersion)) {
    console.log(`
┌───────────────────────────────────────────────────────────────┐
│ 🚀 Dostępna nowa wersja dpn: \x1b[32;1mv${remoteVersion}\x1b[0m (Twoja: v${currentVersion})        │
│ 💡 Wpisz \x1b[1mdpn upgrade\x1b[0m aby automatycznie zaktualizować (OTA)  │
└───────────────────────────────────────────────────────────────┘
`);
  }
}
