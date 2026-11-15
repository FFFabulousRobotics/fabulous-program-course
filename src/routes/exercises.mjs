import { body, send, error } from '../http-response.mjs';
import { judge } from '../judge.mjs';
import { gradeQuestions, correctAnswer } from '../questions.mjs';
import {
  knowledgeReview,
  requireCompleteAnswers,
  solutionQuestion,
  lessonCompleted,
  combineExercise,
  exerciseReview
} from '../learning-results.mjs';

export function exerciseRoutes({
  db,
  save,
  auth,
  trackUserJob,
  lessonFor,
  progress,
  updateProgress,
  submission,
  visibleResult
}) {
  const exerciseJobs = new Set();
  function ensureAttemptAvailable(user, lesson) {
    if (lesson.submissionLimit !== 1) return;
    if (
      db.submissions.some(
        (s) => s.userId === user.id && s.lessonId === lesson.id
      )
    )
      throw error(409, '本练习仅允许提交一次，已保存首次成绩，请查看答案解析');
    if (exerciseJobs.has(user.id + ' ' + lesson.id))
      throw error(409, '本练习正在评测，请勿重复提交');
  }
  async function handle(req, res, url, user) {
    const { pathname: path } = url,
      { method } = req;
    if (path === '/api/submit/exercise' && method === 'POST') {
      const input = await body(req);
      auth(req);
      const lesson = structuredClone(lessonFor(input.lessonId, user));
      if (!lesson.fillQuestions.length && !lesson.codeTask)
        throw error(400, '本教程没有练习');
      if (lesson.fillQuestions.length)
        requireCompleteAnswers(lesson.fillQuestions, input.answers);
      if (
        lesson.codeTask &&
        (typeof input.source !== 'string' ||
          !input.source.trim() ||
          input.source.length > 30000)
      )
        throw error(400, '请填写完整代码，最多 30000 字符');
      ensureAttemptAvailable(user, lesson);
      const jobKey = user.id + ' ' + lesson.id;
      if (lesson.submissionLimit === 1) exerciseJobs.add(jobKey);
      try {
        const signature = (l) =>
            JSON.stringify([
              l.fillQuestions,
              l.codeTask,
              l.scoring,
              l.submissionLimit
            ]),
          version = signature(lesson);
        const knowledge = lesson.fillQuestions.length
          ? gradeQuestions(lesson.fillQuestions, input.answers)
          : null;
        const programming = lesson.codeTask
          ? await trackUserJob(
              user.id,
              judge(input.source, lesson.codeTask, false)
            )
          : null;
        auth(req);
        const current = lessonFor(lesson.id, user);
        if (signature(current) !== version)
          throw error(409, '题目已更新，请刷新后重新交卷，本次不计入成绩');
        const result = combineExercise(knowledge, programming, lesson.scoring),
          previous = progress(user.id, lesson.id),
          alreadyComplete = lessonCompleted(lesson, previous);
        const record = submission(
          user,
          lesson,
          'exercise',
          {
            ...result,
            submissionLimit: lesson.submissionLimit,
            programmingSolution: lesson.codeTask?.solution
              ? {
                  explanation: lesson.codeTask.solution,
                  source: lesson.codeTask.referenceSource || ''
                }
              : undefined,
            answers: Object.fromEntries(
              lesson.fillQuestions.map((q) => [q.id, input.answers[q.id]])
            ),
            questions: lesson.fillQuestions.map(solutionQuestion)
          },
          lesson.codeTask ? input.source : ''
        );
        const review = exerciseReview(db, user.id, current);
        Object.assign(record, {
          attemptCount: review.attemptCount,
          firstScore: review.firstScore,
          firstStatus: review.firstStatus
        });
        const p = updateProgress(user.id, lesson.id, {
          exerciseSubmitted: true,
          fillPassed: knowledge?.status === 'AC' || previous.fillPassed,
          codePassed: programming?.status === 'AC' || previous.codePassed,
          exercisePassed: result.status === 'AC' || alreadyComplete
        });
        await save();
        return send(res, 200, {
          ...visibleResult(exerciseReview(db, user.id, current), user),
          progress: p
        });
      } finally {
        exerciseJobs.delete(jobKey);
      }
    }
    if (path === '/api/submit/fill' && method === 'POST') {
      const input = await body(req);
      auth(req);
      const l = lessonFor(input.lessonId, user);
      if (l.submissionLimit === 1 || l.unifiedExercise)
        throw error(409, '本练习必须提交整份答卷，不能单独提交知识题');
      requireCompleteAnswers(l.fillQuestions, input.answers);
      const details = l.fillQuestions.map((q) => ({
        id: q.id,
        correct: correctAnswer(q, input.answers?.[q.id])
      }));
      const passed = details.filter((d) => d.correct).length,
        total = details.length,
        ok = passed === total;
      if (!total) throw error(400, '本教程没有知识检查题');
      const result = {
        status: ok ? 'AC' : 'WA',
        score: Math.round((passed / total) * 100),
        passed,
        total,
        details,
        message: `${passed}/${total} 题正确`
      };
      submission(user, l, 'fill', {
        ...result,
        answers: Object.fromEntries(
          l.fillQuestions.map((q) => [
            q.id,
            String(input.answers?.[q.id] || '').slice(0, 2000)
          ])
        ),
        questions: l.fillQuestions.map(solutionQuestion)
      });
      const p = updateProgress(user.id, l.id, {
        fillPassed: ok || progress(user.id, l.id).fillPassed
      });
      await save();
      return send(res, 200, {
        ...knowledgeReview(db, user.id, l),
        progress: p
      });
    }
    if (['/api/run', '/api/submit/code'].includes(path) && method === 'POST') {
      const input = await body(req);
      auth(req);
      const l = lessonFor(input.lessonId, user);
      if (!l.codeTask) throw error(400, '本教程没有编程题');
      if (
        path === '/api/submit/code' &&
        (l.submissionLimit === 1 || l.unifiedExercise)
      )
        throw error(409, '本练习必须提交整份答卷，不能单独提交编程题');
      if (
        path === '/api/run' &&
        input.input !== undefined &&
        (typeof input.input !== 'string' || input.input.length > 10000)
      )
        throw error(400, '标准输入最多 10000 字符');
      const task =
        path === '/api/run'
          ? { ...l.codeTask, runInput: input.input ?? '' }
          : l.codeTask;
      const result = await trackUserJob(
        user.id,
        judge(input.source, task, path === '/api/run')
      );
      auth(req);
      lessonFor(l.id, user);
      if (path === '/api/submit/code') {
        submission(user, l, 'code', result, input.source);
        const p = updateProgress(user.id, l.id, {
          codePassed:
            result.status === 'AC' || progress(user.id, l.id).codePassed
        });
        await save();
        return send(res, 200, { ...visibleResult(result, user), progress: p });
      }
      return send(res, 200, result);
    }
    return false;
  }
  return { handle, ensureAttemptAvailable };
}
