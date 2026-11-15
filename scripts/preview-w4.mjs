import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { root } from '../src/runtime-config.mjs';
import { hashPassword } from '../src/identity.mjs';
import { importW4 } from '../src/w4-import.mjs';
import { migrateCourses } from '../src/course-structure.mjs';
import { lessons, curriculumVersion } from '../src/curriculum.mjs';

const data = join(root, 'data', 'w4-preview');
await mkdir(data, { recursive: true });
const password = randomBytes(18).toString('base64url');
const db = {
  users: [{ id: 'preview', username: 'preview', role: 'member', displayName: '本地试卷预览', active: true, passwordHash: hashPassword(password) }],
  lessons: structuredClone(lessons), curriculumVersion,
  progress: [], submissions: [], drafts: [], compilerDrafts: [], sessions: [],
};
migrateCourses(db);
await importW4(db, root, { published: true });
db.courseSettings.homeWeekId = 'week-4';
try {
  await writeFile(join(data, 'store.json'), JSON.stringify(db, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(`本地预览用户名 preview，初始密码 ${password}`);
} catch (e) {
  if (e.code !== 'EEXIST') throw e;
  console.log('本地预览数据已存在，使用此前创建的账号。');
}
console.log(`启动：PORT=5184 FP_DATA_DIR="${data}" node server.mjs`);
