import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { productionOrigin, productionServiceId, backendLabel, tunnelLabel, pinTunnelOrigin, probeBackend, recoveryDecision } from '../src/service-config.mjs';
import { listenGuard } from '../src/listen-guard.mjs';
import { watchdogCycle } from '../src/service-watchdog.mjs';

const config = 'tunnel: keep-this\ningress:\n  - hostname: other.example\n    service: http://localhost:8000\n  - hostname: program.fffabulous.top\n    service: http://localhost:5173\n  - service: http_status:404\n';
const pinned = pinTunnelOrigin(config);
assert.equal(pinned, config.replace('http://localhost:5173', productionOrigin));
assert.equal(pinTunnelOrigin(pinned), pinned);
assert.throws(() => pinTunnelOrigin('ingress: []'), /恰好/);
assert.throws(() => pinTunnelOrigin(config + '  - hostname: program.fffabulous.top\n    service: http://bad\n'), /恰好/);
assert.throws(() => pinTunnelOrigin('  - hostname: program.fffabulous.top\n  - service: http_status:404'), /安全定位/);
assert.deepEqual(recoveryDecision({}, true, 1000000), { failures: 0, lastRestart: 0, restart: false });
let state = recoveryDecision({}, false, 1000000);
assert.equal(state.restart, false);
state = recoveryDecision(state, false, 1030000);
assert.equal(state.restart, false);
state = recoveryDecision(state, false, 1060000);
assert.equal(state.restart, true);
assert.equal(recoveryDecision(state, false, 1090000).restart, false);
assert.equal(recoveryDecision(state, false, 1360000).restart, true);
assert.equal(recoveryDecision(state, true, 1090000).failures, 0);
const calls = [];
const deps = {
  loaded: async () => true,
  restart: async label => calls.push(['restart', label]),
  readTunnel: async () => config,
  writeTunnel: async value => calls.push(['writeTunnel', value]),
  probe: async () => ({ ok: false, reason: 'test timeout' }),
};
let cycle = await watchdogCycle({ ...deps, now: 2000000 });
cycle = await watchdogCycle({ ...deps, previous: cycle, now: 2030000 });
assert.deepEqual(calls, []);
cycle = await watchdogCycle({ ...deps, previous: cycle, now: 2060000 });
assert.deepEqual(calls, [['restart', backendLabel]]);
await watchdogCycle({ ...deps, previous: cycle, now: 2090000 });
assert.equal(calls.length, 1, 'Cooldown must suppress a restart loop');
calls.length = 0;
assert.equal(await watchdogCycle({ ...deps, loaded: async () => false }), null);
assert.deepEqual(calls, [], 'An intentionally stopped job must stay stopped');
await watchdogCycle({ ...deps, probe: async () => ({ ok: true }) });
assert.deepEqual(calls, [['writeTunnel', pinned], ['restart', tunnelLabel]]);
calls.length = 0;
await watchdogCycle({ ...deps, probe: async () => ({ ok: true }), readTunnel: async () => pinned });
assert.deepEqual(calls, [], 'Healthy services with correct routing must not restart');
await assert.rejects(watchdogCycle({ ...deps, probe: async () => ({ ok: true }), readTunnel: async () => 'broken' }));
assert.deepEqual(calls, [], 'Unrecognized routing must not overwrite configuration');

let response = { name: 'FabulousProgram', serviceId: productionServiceId };
let hung = false;
const fake = http.createServer((req, res) => { if (hung) return; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(response)); });
fake.listen(0, '127.0.0.1'); await once(fake, 'listening');
const port = fake.address().port, origin = `http://127.0.0.1:${port}`;
const data = await mkdtemp(join(tmpdir(), 'program-port-guard-'));
try {
  assert.equal((await probeBackend(origin)).ok, true);
  response = { name: 'FabulousProgram' };
  assert.equal((await probeBackend(origin)).ok, false);
  response = { status: 'healthy' };
  assert.equal((await probeBackend(origin)).ok, false);
  hung = true;
  assert.equal((await probeBackend(origin, 50)).ok, false);
  hung = false;
  await assert.rejects(listenGuard(port, () => {}), /未读写账号或成绩/);
  await assert.rejects(listenGuard(-1, () => {}), /整数/);
  const root = resolve(import.meta.dirname, '..');
  const child = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: String(port), FP_DATA_DIR: data }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', x => output += x); child.stderr.on('data', x => output += x);
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  const [code] = await once(child, 'exit'); clearTimeout(timer);
  assert.notEqual(code, 0);
  assert.match(output, /被占用.*未读写账号或成绩/);
  assert.deepEqual(await readdir(data), [], 'Occupied port must not create or migrate any database');
  console.log('PASS: dedicated IPv4 origin, route isolation, foreign-service and timeout detection, three-failure recovery, five-minute cooldown, occupied-port startup leaves data untouched');
} finally {
  fake.closeAllConnections(); await new Promise(done => fake.close(done));
  await rm(data, { recursive: true, force: true });
}
