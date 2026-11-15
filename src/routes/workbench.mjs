import { body, send, error, now } from '../http-response.mjs';
import { judge } from '../judge.mjs';
import {
  createSimulation,
  simulationState,
  simulationCommand,
  closeSimulation
} from '../beta.mjs';
import { tokenDigest } from '../identity.mjs';

export function workbenchRoutes({ db, save, auth, trackUserJob, lessonFor }) {
  function validateCompiler(input) {
    if (
      typeof input.source !== 'string' ||
      input.source.length > 30000 ||
      typeof input.input !== 'string' ||
      input.input.length > 20000
    )
      throw error(400, '代码最多 30000 字符，标准输入最多 20000 字符');
  }
  return async (req, res, url, user) => {
    const { pathname: path } = url,
      { method } = req;
    if (path === '/api/compiler/draft' && method === 'GET')
      return send(res, 200, {
        draft: db.compilerDrafts.find((d) => d.userId === user.id) || null
      });
    if (path === '/api/compiler/draft' && method === 'PUT') {
      const input = await body(req);
      auth(req);
      validateCompiler(input);
      let draft = db.compilerDrafts.find((d) => d.userId === user.id);
      if (!draft) {
        draft = { userId: user.id };
        db.compilerDrafts.push(draft);
      }
      Object.assign(draft, {
        source: input.source,
        input: input.input,
        updatedAt: now()
      });
      await save();
      return send(res, 200, { ok: true });
    }
    if (path === '/api/compiler/run' && method === 'POST') {
      const input = await body(req);
      auth(req);
      validateCompiler(input);
      if (!input.source.trim()) throw error(400, '请输入 Java 代码');
      const result = await trackUserJob(
        user.id,
        judge(input.source, { kind: 'java', runInput: input.input }, true)
      );
      auth(req);
      return send(res, 200, result);
    }
    if (path === '/api/sim' && method === 'POST') {
      const input = await body(req);
      auth(req);
      const lesson = lessonFor(input.lessonId, user);
      if (!lesson.codeTask || lesson.codeTask.kind === 'java')
        throw error(400, '只有机器人课程可以启动 Beta8397');
      const owner = tokenDigest(req.headers.authorization.slice(7));
      const result = await trackUserJob(
        user.id,
        createSimulation(input.source, owner, user.id).then(async (result) => {
          try {
            auth(req);
            lessonFor(lesson.id, user);
          } catch (e) {
            await closeSimulation(result.id, owner);
            throw e;
          }
          return result;
        })
      );
      return send(res, 201, result);
    }
    if (path.startsWith('/api/sim/')) {
      const id = path.split('/')[3],
        owner = tokenDigest(req.headers.authorization.slice(7));
      if (method === 'GET')
        return send(res, 200, await simulationState(id, owner));
      if (method === 'POST') {
        const input = await body(req);
        auth(req);
        return send(res, 200, await simulationCommand(id, owner, input));
      }
      if (method === 'DELETE')
        return send(res, 200, await closeSimulation(id, owner));
    }
    return false;
  };
}
