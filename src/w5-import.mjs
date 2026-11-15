import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateTask } from './task-config.mjs';
import { validateQuestions } from './questions.mjs';

export async function buildW5(root) {
  const source = await readFile(join(root, 'course/W5/exercises.json'), 'utf8'),
    data = JSON.parse(source);
  if (data.version !== 1 || data.papers.length !== 8)
    throw Error('W5题库版本或数量错误');
  const papers = data.papers.map((p, i) => {
    const questions = validateQuestions(p.fillQuestions),
      task = validateTask(p.codeTask);
    if (
      questions.length !== 9 ||
      questions.filter((q) => q.type === 'boolean').length !== 5 ||
      questions.filter((q) => q.type === 'choice').length !== 2 ||
      questions.filter((q) => q.type === 'fill').length !== 2 ||
      questions.reduce((s, q) => s + q.points, 0) !== 60
    )
      throw Error('W5题型或分值错误');
    if (p.key !== task.variant) throw Error('W5题库标识与评测版本不一致');
    return {
      key: p.key,
      lesson: {
        id: 'w5-special-' + p.key,
        weekId: 'week-5',
        code: 'W5',
        position: i + 1,
        order: i + 1,
        title: p.title,
        subtitle: p.subtitle,
        estimate: '专项练习',
        content: '',
        exerciseOnly: true,
        submissionLimit: 1,
        acScoring: 'first-score',
        scoring: { knowledgeWeight: 60, programmingWeight: 40 },
        published: false,
        publishAt: null,
        fillQuestions: questions,
        codeTask: task
      }
    };
  });
  if (new Set(papers.map((p) => p.key)).size !== 8)
    throw Error('W5题库标识重复');
  return { papers, digest: createHash('sha256').update(source).digest('hex') };
}

// Explicit maintenance operation only. Never called during server startup.
export async function importW5(
  db,
  root,
  { published = false, assignments: privateAssignments } = {}
) {
  const { papers, digest } = await buildW5(root);
  if (
    !privateAssignments ||
    Object.getPrototypeOf(privateAssignments) !== Object.prototype ||
    Object.keys(privateAssignments).length !== papers.length
  )
    throw Error('请从独立文件提供每套题库的成员分配');
  const seen = new Set();
  const assignments = papers.map((p) => {
    const names =
      Object.hasOwn(privateAssignments, p.key) && privateAssignments[p.key];
    if (
      !Array.isArray(names) ||
      !names.length ||
      names.some((name) => typeof name !== 'string' || !name.trim())
    )
      throw Error('成员分配无效：' + p.key);
    const ids = names.map((name) => {
      const matches = db.users.filter(
        (u) =>
          u.username.toLowerCase() === name.trim().toLowerCase() &&
          u.role === 'member' &&
          u.active
      );
      if (matches.length !== 1 || seen.has(matches[0].id))
        throw Error('成员不存在、已停用或重复分配：' + p.key);
      seen.add(matches[0].id);
      return matches[0].id;
    });
    return { ...p, ids };
  });
  if (db.imports?.w5) {
    const existing = db.lessons.filter((l) => l.weekId === 'week-5');
    if (
      existing.length !== papers.length ||
      !db.weeks.some((w) => w.id === 'week-5' && w.number === 5) ||
      assignments.some((p) => {
        const l = existing.find((l) => l.id === p.lesson.id);
        return (
          !l ||
          JSON.stringify([...(l.assignedUserIds ?? [])].sort()) !==
            JSON.stringify([...p.ids].sort())
        );
      })
    )
      throw Error('现有W5与题库或成员分配不一致，拒绝覆盖');
    return false;
  }
  if (
    db.weeks.some((w) => w.number === 5 || w.id === 'week-5') ||
    db.lessons.some(
      (l) => l.weekId === 'week-5' || l.id.startsWith('w5-special-')
    )
  )
    throw Error('W5已存在，拒绝覆盖课程或作答');
  db.weeks.push({
    id: 'week-5',
    number: 5,
    code: 'W5',
    title: '专项训练',
    description:
      '按账号分配的专项练习：5道判断、2道选择、2道填空、1道程序题。补漏与提高，共100分。',
    published,
    publishAt: null
  });
  for (const p of assignments)
    db.lessons.push({ ...p.lesson, published, assignedUserIds: p.ids });
  db.imports ||= {};
  db.imports.w5 = {
    digest,
    createdAt: new Date().toISOString(),
    assignments: assignments.map((p) => ({
      lessonId: p.lesson.id,
      userIds: p.ids
    }))
  };
  return true;
}
