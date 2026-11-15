import { randomUUID } from 'node:crypto';
import { orderedLessons, lessonVisible } from './course-structure.mjs';
import { lessonCompleted, submissionStats } from './learning-results.mjs';
import { publicQuestion } from './questions.mjs';
import { error, now } from './http-response.mjs';

export function learningStore(db) {
  function lessonFor(id, user) {
    const item = db.lessons.find(
      (l) => l.id === id && lessonVisible(db, l, user)
    );
    if (!item) throw error(404, '教程不存在或未发布');
    return item;
  }
  function progress(userId, lessonId) {
    return (
      db.progress.find(
        (p) => p.userId === userId && p.lessonId === lessonId
      ) || {
        userId,
        lessonId,
        read: false,
        fillPassed: false,
        codePassed: false
      }
    );
  }
  function updateProgress(userId, lessonId, patch) {
    let p = db.progress.find(
      (p) => p.userId === userId && p.lessonId === lessonId
    );
    if (!p) {
      p = progress(userId, lessonId);
      db.progress.push(p);
    }
    Object.assign(p, patch, { updatedAt: now() });
    return p;
  }
  const completed = lessonCompleted;
  function visibleLessons(user) {
    return orderedLessons(db).filter((l) => lessonVisible(db, l, user));
  }
  function stats(user) {
    const ls = visibleLessons(user),
      ids = new Set(ls.map((l) => l.id));
    const submissions = db.submissions.filter(
      (s) => s.userId === user.id && ids.has(s.lessonId)
    );
    return {
      accepted: ls.filter((l) => completed(l, progress(user.id, l.id))).length,
      ...submissionStats(submissions, ls),
      total: ls.length
    };
  }
  function publicLesson(l, user) {
    const result = structuredClone(l);
    if (user.role !== 'admin') {
      delete result.assignedUserIds;
      result.fillQuestions = result.fillQuestions.map(publicQuestion);
      if (result.codeTask) {
        result.codeTask.tests = result.codeTask.tests.map((t) => ({
          name: t.name
        }));
        delete result.codeTask.rules;
        delete result.codeTask.variant;
        delete result.codeTask.referenceSource;
        delete result.codeTask.solution;
      }
    }
    return result;
  }
  function submission(user, l, kind, result, source = '') {
    const record = {
      id: randomUUID(),
      userId: user.id,
      lessonId: l.id,
      lessonTitle: l.title,
      kind,
      ...result,
      source,
      createdAt: now()
    };
    db.submissions.unshift(record);
    return record;
  }
  function visibleResult(result, user) {
    if (!result) return null;
    if (user.role === 'admin') return result;
    const copy = structuredClone(result);
    for (const c of copy.cases || []) delete c.expected;
    if (copy.programming)
      copy.programming = visibleResult(copy.programming, user);
    return copy;
  }
  return {
    lessonFor,
    progress,
    updateProgress,
    completed,
    visibleLessons,
    stats,
    publicLesson,
    submission,
    visibleResult
  };
}
