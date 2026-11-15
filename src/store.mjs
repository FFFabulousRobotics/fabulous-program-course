import { mkdir, readFile, writeFile, rename, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { lessons as curriculum, curriculumVersion } from './curriculum.mjs';
import { initialMaterials, migrateW2Material } from './materials.mjs';
import {
  migrateCourses,
  publishDueCourses,
  migrateWeekPublication
} from './course-structure.mjs';
import { migrateKnowledgeChoices } from './knowledge-migration.mjs';
import { backfillSubmittedExercises } from './learning-results.mjs';
import { hashPassword } from './identity.mjs';

function newSite() {
  const users = [];
  const { FP_BOOTSTRAP_OWNER: username, FP_BOOTSTRAP_PASSWORD: password } =
    process.env;
  if (username !== undefined || password !== undefined) {
    if (
      !/^[A-Za-z0-9_]{3,20}$/.test(username || '') ||
      !password ||
      password.length < 10 ||
      password.length > 200
    ) {
      throw Error('首次建站请提供 3–20 位用户名和 10–200 位 Owner 密码');
    }
    users.push({
      id: randomUUID(),
      username,
      displayName: username,
      role: 'admin',
      owner: true,
      active: true,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString()
    });
  }
  return { users, lessons: [], progress: [], submissions: [] };
}

export async function openStore(dataDir) {
  const file = join(dataDir, 'store.json');
  await mkdir(dataDir, { recursive: true });
  let db;
  try {
    db = JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    db = newSite();
  }
  let saving = Promise.resolve();
  function save() {
    const snapshot = JSON.stringify(db, null, 2);
    const job = saving
      .catch(() => {})
      .then(async () => {
        await writeFile(file + '.next', snapshot, { mode: 0o600 });
        await rename(file + '.next', file);
      });
    saving = job;
    return job;
  }
  if (db.curriculumVersion !== curriculumVersion) {
    if (db.version)
      await copyFile(
        file,
        join(dataDir, 'backup-before-w1-' + Date.now() + '.json')
      );
    db.archivedLessons = [...(db.archivedLessons || []), ...db.lessons];
    db.lessons = structuredClone(curriculum);
    db.tracks = [];
    db.curriculumVersion = curriculumVersion;
  }
  // Update only the original runtime explanation; preserve all user-authored course edits and records.
  for (const lesson of db.lessons)
    lesson.content = lesson.content.replace(
      '本地评测运行官方 LinearOpMode 类，由桌面测试驱动发送 START / STOP 并收集 telemetry。它不连接真实电机，也不模拟摩擦、碰撞或相机；这些需要机器人实测。',
      '运行代码时会打开 Beta8397 二维仿真：点击 INIT 初始化、START 开始、STOP 停止，观察实时 telemetry。提交评测时由系统自动检查这些行为。代码先经过官方 FTC SDK 编译检查，再运行在 Beta8397 的兼容 SDK 与虚拟硬件中；这不是 Android Control Hub，也不代表已通过真机验收。'
    );
  db.version = 2;
  db.sessions ||= [];
  db.drafts ||= [];
  db.materials ??= initialMaterials();
  db.compilerDrafts ||= [];
  if (db.materialOrderVersion !== 1) {
    for (const item of initialMaterials()) {
      const current = db.materials.find((m) => m.id === item.id);
      if (current) current.order = item.order;
    }
    db.materialOrderVersion = 1;
  }
  if (db.courseStructureVersion !== 1) {
    if (db.version)
      await copyFile(
        file,
        join(dataDir, 'backup-before-course-structure-' + Date.now() + '.json')
      ).catch((e) => {
        if (e.code !== 'ENOENT') throw e;
      });
    migrateCourses(db);
  }
  if (db.weekPublicationVersion !== 1 || db.knowledgeChoicesVersion !== 1)
    await copyFile(
      file,
      join(dataDir, 'backup-before-learning-policy-' + Date.now() + '.json')
    ).catch((e) => {
      if (e.code !== 'ENOENT') throw e;
    });
  migrateWeekPublication(db);
  migrateKnowledgeChoices(db);
  backfillSubmittedExercises(db);
  publishDueCourses(db);
  if (migrateW2Material(db))
    await copyFile(
      file,
      join(dataDir, 'backup-before-w2-material-' + Date.now() + '.json')
    ).catch((e) => {
      if (e.code !== 'ENOENT') throw e;
    });
  await save();
  let publicationPending = false,
    publicationJob = null;
  function flushScheduledCourses() {
    if (publicationJob) return publicationJob;
    if (publishDueCourses(db)) publicationPending = true;
    if (migrateW2Material(db)) publicationPending = true;
    if (!publicationPending) return Promise.resolve();
    publicationPending = false;
    publicationJob = save()
      .catch((e) => {
        publicationPending = true;
        throw e;
      })
      .finally(() => {
        publicationJob = null;
      });
    return publicationJob;
  }
  return { db, save, waitForSave: () => saving, flushScheduledCourses };
}
