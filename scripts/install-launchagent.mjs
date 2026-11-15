import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, writeFile, readFile, copyFile, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import net from 'node:net';
import { productionPort, productionServiceId, backendLabel, tunnelLabel, watchdogLabel, pinTunnelOrigin, probeBackend } from '../src/service-config.mjs';

if (process.platform !== 'darwin') throw new Error('LaunchAgent 仅适用于 macOS。');
if (process.getuid() === 0) throw new Error('请以当前登录用户运行，不要使用 sudo。');

const root = resolve(import.meta.dirname, '..');
const home = homedir();
const runtimeEnv = Object.fromEntries(['FP_JAVA_HOME','FP_SOFFICE_PATH','FP_COURSE_DIR']
  .filter(key => process.env[key]).map(key => [key,resolve(process.env[key])]));
const label = backendLabel;
const domain = `gui/${process.getuid()}`;
const service = `${domain}/${label}`;
const plist = join(home, 'Library/LaunchAgents', `${label}.plist`);
const logs = join(home, 'Library/Logs/FabulousProgram');
const xml = value => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[c]));
const run = (...args) => execFileSync('/bin/launchctl', args, { stdio: 'inherit' });

// Refuse a foreign listener before stopping the working backend or replacing config.
const occupied = await new Promise((done, reject) => {
  const socket = net.connect({ host: '127.0.0.1', port: productionPort });
  socket.once('connect', () => { socket.destroy(); done(true); });
  socket.once('error', e => e.code === 'ECONNREFUSED' ? done(false) : reject(e));
  socket.setTimeout(2000, () => { socket.destroy(); reject(Error('正式端口检查超时')); });
});
if (occupied && !(await probeBackend()).ok) throw Error(`127.0.0.1:${productionPort} 已被其他服务占用，保留现有服务与配置，请先检查占用进程。`);

// launchd does not load shell profiles. Record absolute paths and the data directory.
await mkdir(dirname(plist), { recursive: true });
await mkdir(logs, { recursive: true });
await writeFile(plist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array><string>${xml(process.execPath)}</string><string>${xml(join(root, 'server.mjs'))}</string></array>
  <key>WorkingDirectory</key><string>${xml(root)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key><string>${xml(home)}</string>
    <key>PATH</key><string>${xml(dirname(process.execPath))}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>NODE_ENV</key><string>production</string>
    <key>PORT</key><string>${productionPort}</string>
    <key>FP_SERVICE_ID</key><string>${productionServiceId}</string>
    <key>FP_DATA_DIR</key><string>${xml(resolve(process.env.FP_DATA_DIR || join(root, 'data')))}</string>
    ${Object.entries(runtimeEnv).map(([key,path])=>`<key>${key}</key><string>${xml(path)}</string>`).join('\n    ')}
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>5</integer>
  <key>ExitTimeOut</key><integer>30</integer>
  <key>StandardOutPath</key><string>${xml(join(logs, 'backend.log'))}</string>
  <key>StandardErrorPath</key><string>${xml(join(logs, 'backend.error.log'))}</string>
</dict>
</plist>
`, { mode: 0o644 });

execFileSync('/usr/bin/plutil', ['-lint', plist], { stdio: 'inherit' });
run('enable', service);
if (spawnSync('/bin/launchctl', ['print', service], { stdio: 'ignore' }).status === 0) {
  run('bootout', service);
}
run('bootstrap', domain, plist);
// Wait for this exact production service before changing the public route.
let health;
for (let i = 0; i < 30; i++) {
  health = await probeBackend(undefined, 1000);
  if (health.ok) break;
  await new Promise(resolveWait => setTimeout(resolveWait, 500));
}
if (!health?.ok) throw Error(`课程后台未就绪，未修改外网转发：${health?.reason}`);
const tunnelConfig = join(home, '.cloudflared/program.yml');
try {
  const before = await readFile(tunnelConfig, 'utf8');
  const after = pinTunnelOrigin(before);
  if (after !== before) {
    await copyFile(tunnelConfig, `${tunnelConfig}.before-service-${Date.now()}`);
    await writeFile(`${tunnelConfig}.next`, after, { mode: 0o600 });
    await rename(`${tunnelConfig}.next`, tunnelConfig);
    if (spawnSync('/bin/launchctl', ['print', `${domain}/${tunnelLabel}`], { stdio: 'ignore' }).status === 0) run('kickstart', '-k', `${domain}/${tunnelLabel}`);
  }
} catch (e) { if (e.code !== 'ENOENT') throw e; }

const watchdogPlist = join(dirname(plist), `${watchdogLabel}.plist`);
await writeFile(watchdogPlist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${watchdogLabel}</string>
  <key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(join(root, 'scripts/service-watchdog.mjs'))}</string></array>
  <key>WorkingDirectory</key><string>${xml(root)}</string>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>30</integer>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${xml(join(logs, 'watchdog.log'))}</string>
  <key>StandardErrorPath</key><string>${xml(join(logs, 'watchdog.error.log'))}</string>
</dict></plist>
`, { mode: 0o644 });
execFileSync('/usr/bin/plutil', ['-lint', watchdogPlist], { stdio: 'inherit' });
run('enable', `${domain}/${watchdogLabel}`);
if (spawnSync('/bin/launchctl', ['print', `${domain}/${watchdogLabel}`], { stdio: 'ignore' }).status === 0) run('bootout', `${domain}/${watchdogLabel}`);
run('bootstrap', domain, watchdogPlist);
console.log(`已安装并加载 ${service}\n正式站：http://127.0.0.1:${productionPort}\n保护：每 30 秒检查，连续 3 次失败才重启，重启间隔至少 5 分钟\n配置：${plist}\n日志：${logs}`);
