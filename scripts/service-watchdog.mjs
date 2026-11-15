import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir, copyFile, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { watchdogCycle } from '../src/service-watchdog.mjs';

if (process.platform !== 'darwin') throw Error('服务保护仅用于 macOS LaunchAgent');
const domain = `gui/${process.getuid()}`;
const logs = join(homedir(), 'Library/Logs/FabulousProgram');
const statePath = join(logs, 'watchdog-state.json');
const configPath = join(homedir(), '.cloudflared/program.yml');
const loaded = label => spawnSync('/bin/launchctl', ['print', `${domain}/${label}`], { stdio: 'ignore', timeout: 5000 }).status === 0;
const restart = label => execFileSync('/bin/launchctl', ['kickstart', '-k', `${domain}/${label}`], { timeout: 10000, stdio: 'pipe' });
const log = message => console.log(`${new Date().toISOString()} ${message}`);

await mkdir(logs, { recursive: true });
let previous;
try { previous = JSON.parse(await readFile(statePath, 'utf8')); }
catch (e) { if (e.code !== 'ENOENT') throw e; previous = {}; }
const next = await watchdogCycle({
  previous, loaded, restart, log,
  readTunnel: () => readFile(configPath, 'utf8'),
  writeTunnel: async after => {
    await copyFile(configPath, `${configPath}.before-watchdog-${Date.now()}`);
    const temporary = `${configPath}.next`;
    await writeFile(temporary, after, { mode: 0o600 });
    await rename(temporary, configPath);
  },
});
if (!next) process.exit(0);
await writeFile(`${statePath}.next`, JSON.stringify(next, null, 2));
await rename(`${statePath}.next`, statePath);
