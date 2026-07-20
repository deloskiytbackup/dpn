import https from 'node:https';
import child_process from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';

const GITHUB_API_URL = 'https://api.github.com/repos/deloskiytbackup/dpn/contents/package.json';

export async function checkRemoteVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const options = {
      headers: {
        'User-Agent': 'dpn-cli-ota',
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 2500
    };

    const req = https.get(GITHUB_API_URL, options, (res) => {
      if (res.statusCode !== 200) {
        resolve(null);
        return;
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.content) {
            const decoded = Buffer.from(json.content, 'base64').toString('utf-8');
            const pkg = JSON.parse(decoded);
            resolve(pkg.version || null);
          } else {
            resolve(null);
          }
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
    console.log('⬇️  1/3 Pobieranie i synchronizacja najnowszego kodu z GitHuba...');
    child_process.execSync('git fetch origin main && git reset --hard origin/main', { cwd: dpnRepoDir, stdio: 'inherit' });

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
