import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { root } from '../src/runtime-config.mjs';

async function checkFolder(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory() && entry.name !== 'pdfjs') await checkFolder(path);
    if (entry.isFile() && /\.m?js$/.test(entry.name)) check(path);
  }
}
function check(path) {
  const result = spawnSync(process.execPath, ['--check', path], {
    stdio: 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
for (const folder of ['src', 'public', 'scripts', 'tests'])
  await checkFolder(join(root, folder));
check(join(root, 'server.mjs'));
