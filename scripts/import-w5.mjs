import { productionPort } from '../src/service-config.mjs';
import { readFile, writeFile, rename, copyFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import net from 'node:net';
import { importW5 } from '../src/w5-import.mjs';

const root = resolve(import.meta.dirname, '..'),
  data = resolve(process.env.FP_DATA_DIR || join(root, 'data')),
  file = join(data, 'store.json');
const args = new Set(process.argv.slice(2)),
  apply = args.has('--apply'),
  publish = args.has('--publish');
const assignmentPath = process.env.FP_W5_ASSIGNMENTS;
if (!assignmentPath)
  throw Error('请设置 FP_W5_ASSIGNMENTS 指向仓库外的分配 JSON 文件');
const assignments = JSON.parse(await readFile(assignmentPath, 'utf8'));
const db = JSON.parse(await readFile(file, 'utf8')),
  preview = structuredClone(db);
const changed = await importW5(preview, root, {
  published: publish,
  assignments
});
console.log(
  JSON.stringify(
    {
      changed,
      published: publish,
      assignments: preview.lessons
        .filter((l) => l.weekId === 'week-5')
        .map((l) => ({
          id: l.id,
          title: l.title,
          memberCount: l.assignedUserIds.length
        }))
    },
    null,
    2
  )
);
if (apply && changed) {
  if (!args.has('--server-stopped'))
    throw Error('请先停止后台，再使用 --server-stopped');
  const listening = await new Promise((resolveCheck, reject) => {
    const socket = net.connect({
      host: '127.0.0.1',
      port: Number(process.env.PORT || productionPort)
    });
    socket.once('connect', () => {
      socket.destroy();
      resolveCheck(true);
    });
    socket.once('error', (e) =>
      e.code === 'ECONNREFUSED' ? resolveCheck(false) : reject(e)
    );
    socket.setTimeout(3000, () => {
      socket.destroy();
      reject(Error('无法确认服务已停止'));
    });
  });
  if (listening) throw Error('后台端口仍在监听，拒绝修改正式数据');
  const backup = join(data, 'backup-before-w5-' + Date.now() + '.json');
  await copyFile(file, backup);
  if (publish) {
    preview.courseSettings ||= {};
    preview.courseSettings.homeWeekId = 'week-5';
  }
  await writeFile(file + '.next', JSON.stringify(preview, null, 2));
  await rename(file + '.next', file);
  console.log('W5导入完成；数据备份：' + backup);
}
