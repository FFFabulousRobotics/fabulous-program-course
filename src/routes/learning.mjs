import { safeUser } from '../identity.mjs';
import { body, send, error, now } from '../http-response.mjs';
import { engine } from '../judge.mjs';
import { orderedWeeks, weekVisible, homeWeek } from '../course-structure.mjs';
import {
  knowledgeReview,
  exerciseReview,
  chronological
} from '../learning-results.mjs';

export function learningRoutes({
  db,
  save,
  auth,
  lessonFor,
  progress,
  updateProgress,
  completed,
  visibleLessons,
  stats,
  publicLesson,
  visibleResult,
  ensureAttemptAvailable
}) {
  return async (req, res, url, user) => {
    const { pathname: path } = url,
      { method } = req;
    if (path === '/api/bootstrap' && method === 'GET')
      return send(res, 200, {
        user: safeUser(user),
        weeks: orderedWeeks(db).filter((w) => weekVisible(db, w, user)),
        homeWeekId: homeWeek(db, user)?.id || null,
        courseSettings: user.role === 'admin' ? db.courseSettings : undefined,
        lessons: visibleLessons(user).map((l) => ({
          id: l.id,
          weekId: l.weekId,
          exerciseOnly: l.exerciseOnly,
          submissionLimit: l.submissionLimit,
          position: l.position,
          hasFill: !!l.fillQuestions.length,
          code: l.code,
          title: l.title,
          subtitle: l.subtitle,
          estimate: l.estimate,
          order: l.order,
          published: l.published,
          publishAt: user.role === 'admin' ? l.publishAt || null : undefined,
          hasCode: !!l.codeTask,
          progress: progress(user.id, l.id),
          complete: completed(l, progress(user.id, l.id))
        })),
        stats: stats(user),
        engine
      });
    const parts = path.split('/');
    const id = parts[3];
    if (parts[2] === 'lessons' && id && method === 'GET') {
      const l = lessonFor(id, user);
      return send(res, 200, {
        lesson: publicLesson(l, user),
        progress: progress(user.id, id),
        exerciseResult: visibleResult(exerciseReview(db, user.id, l), user),
        knowledgeResult: knowledgeReview(db, user.id, l),
        codeResult: visibleResult(
          chronological(
            db.submissions.filter(
              (s) =>
                s.userId === user.id && s.lessonId === id && s.kind === 'code'
            )
          ).at(-1) || null,
          user
        ),
        draft: db.drafts.find(
          (d) => d.userId === user.id && d.lessonId === id
        ) || { source: l.codeTask?.starter || '', answers: {} }
      });
    }
    if (parts[2] === 'progress' && id && method === 'POST') {
      lessonFor(id, user);
      await body(req);
      auth(req);
      lessonFor(id, user);
      const p = updateProgress(user.id, id, { read: true });
      await save();
      return send(res, 200, { progress: p });
    }
    if (parts[2] === 'drafts' && id && method === 'PUT') {
      lessonFor(id, user);
      const input = await body(req);
      auth(req);
      const draftLesson = lessonFor(id, user);
      ensureAttemptAvailable(user, draftLesson);
      if (typeof input.source !== 'string' || input.source.length > 30000)
        throw error(400, '草稿过长或格式错误');
      const answers = Object.fromEntries(
        Object.entries(input.answers || {}).map(([k, v]) => [
          k,
          String(v).slice(0, 2000)
        ])
      );
      let draft = db.drafts.find(
        (d) => d.userId === user.id && d.lessonId === id
      );
      if (!draft) {
        draft = { userId: user.id, lessonId: id };
        db.drafts.push(draft);
      }
      Object.assign(draft, { source: input.source, answers, updatedAt: now() });
      await save();
      return send(res, 200, { ok: true });
    }
    if (path === '/api/submissions' && method === 'GET') {
      const all =
        user.role === 'admin' && url.searchParams.get('scope') === 'all';
      const ids = new Set(visibleLessons(user).map((l) => l.id));
      return send(res, 200, {
        submissions: db.submissions
          .filter((s) => (all || s.userId === user.id) && ids.has(s.lessonId))
          .map((s) => ({
            ...visibleResult(s, user),
            user:
              db.users.find((u) => u.id === s.userId)?.displayName ||
              '已停用成员'
          }))
      });
    }
    if (path === '/api/rankings' && method === 'GET')
      return send(res, 200, {
        rankings: db.users
          .filter((u) => u.active && u.role === 'member')
          .map((u) => ({
            user: { id: u.id, displayName: u.displayName },
            ...stats(u)
          }))
          .sort(
            (a, b) => b.accepted - a.accepted || (b.rate || 0) - (a.rate || 0)
          )
      });
    return false;
  };
}
