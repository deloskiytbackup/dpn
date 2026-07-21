import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export async function runScript(scriptName: string, projectDir: string): Promise<void> {
  const pkgJsonPath = path.join(projectDir, 'package.json');

  if (!fs.existsSync(pkgJsonPath)) {
    throw new Error('Nie znaleziono pliku package.json w bieżącym katalogu.');
  }

  const pkgJson = JSON.parse(await fs.promises.readFile(pkgJsonPath, 'utf-8'));
  const scripts = pkgJson.scripts || {};

  const command = scripts[scriptName];
  if (!command) {
    throw new Error(`Brak skryptu "${scriptName}" w sekcji scripts w package.json.`);
  }

  const nodeModulesDir = path.resolve(projectDir, 'node_modules');
  const binDir = path.resolve(nodeModulesDir, '.bin');
  const nodeBinDir = path.dirname(process.execPath);

  const existingNodePath = process.env.NODE_PATH || '';
  const env: Record<string, string | undefined> = {
    ...process.env,
    NODE_PATH: existingNodePath ? `${nodeModulesDir}${path.delimiter}${existingNodePath}` : nodeModulesDir,
    NEXT_DISABLE_PACKAGE_INSTALL: '1'
  };
  
  const pathKey = Object.keys(env).find(k => k.toLowerCase() === 'path') || 'PATH';
  const existingPath = env[pathKey] || '';
  env[pathKey] = `${binDir}${path.delimiter}${nodeBinDir}${path.delimiter}${existingPath}`;

  console.log(`[dpn run] Uruchamianie skryptu "${scriptName}": ${command}`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd: projectDir,
      stdio: 'inherit',
      shell: true,
      env
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Skrypt zakończył się kodem błędu ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}
