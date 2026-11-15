import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

export const root = resolve(import.meta.dirname, '..');
export const dataDirectory = resolve(
  process.env.FP_DATA_DIR || join(root, 'data')
);
export const ftcVersion = '11.0.0';
const executable = (name) =>
  process.platform === 'win32' ? `${name}.exe` : name;

export async function javaToolchain() {
  let javaHome = process.env.FP_JAVA_HOME || process.env.JAVA_HOME;
  if (!javaHome) {
    const local = await readFile(join(root, 'sdk/runtime.json'), 'utf8').catch(
      (e) => {
        if (e.code !== 'ENOENT') throw e;
        return '{}';
      }
    );
    javaHome = JSON.parse(local).javaHome;
  }
  if (!javaHome && process.platform === 'darwin') {
    try {
      javaHome = execFileSync('/usr/libexec/java_home', ['-F', '-v', '21'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
    } catch {}
  }
  return {
    java: javaHome
      ? join(javaHome, 'bin', executable('java'))
      : executable('java'),
    javac: javaHome
      ? join(javaHome, 'bin', executable('javac'))
      : executable('javac')
  };
}
