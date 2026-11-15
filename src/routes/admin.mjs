import { body, send, error, now } from '../http-response.mjs';
import { randomUUID } from 'node:crypto';
import { hashPassword as hash, safeUser } from '../identity.mjs';
import { judge } from '../judge.mjs';
import { validateTask } from '../task-config.mjs';
import { memberProgress } from '../member-progress.mjs';

export function adminRoutes({ db, save, auth, trackUserJob, stats }) {
  return async (req, res, url, user) => {
    const { pathname: path } = url,
      { method } = req;
    auth(req, 'admin');
    const parts = path.split('/');
    if (path === '/api/admin/trial' && method === 'POST') {
      const input = await body(req),
        task = validateTask(input.codeTask);
      if (!task) throw error(400, '请先启用编程题');
      const result = await trackUserJob(
        user.id,
        judge(input.source, task, false)
      );
      auth(req, 'admin');
      return send(res, 200, { ...result, trial: true });
    }
    if (path === '/api/admin/activity' && method === 'GET') {
      const members = db.users
        .filter((u) => u.role === 'member')
        .map((u) => {
          const records = db.submissions.filter((s) => s.userId === u.id),
            drafts = db.drafts.filter((d) => d.userId === u.id),
            progresses = db.progress.filter((p) => p.userId === u.id);
          const timestamps = [
            u.lastActiveAt,
            ...records.map((s) => s.createdAt),
            ...drafts.map((d) => d.updatedAt),
            ...progresses.map((p) => p.updatedAt)
          ]
            .filter(Boolean)
            .sort();
          return {
            user: safeUser(u),
            ...stats(u),
            lastActiveAt: timestamps.at(-1) || null,
            recentSubmissions: records.filter(
              (s) => Date.parse(s.createdAt) >= Date.now() - 7 * 86400000
            ).length
          };
        });
      const enabled = members.filter((m) => m.user.active),
        active7 = enabled.filter(
          (m) => Date.parse(m.lastActiveAt) >= Date.now() - 7 * 86400000
        ).length;
      return send(res, 200, {
        members: members.sort((a, b) =>
          (b.lastActiveAt || '').localeCompare(a.lastActiveAt || '')
        ),
        enabled: enabled.length,
        active7,
        rate: enabled.length
          ? Math.round((active7 / enabled.length) * 100)
          : null,
        published: db.lessons.filter((l) => l.published).length,
        drafts: db.lessons.filter((l) => !l.published).length
      });
    }
    const userRecords = path.match(
      /^\/api\/admin\/users\/([^/]+)\/submissions$/
    );
    if (userRecords && method === 'GET') {
      const target = db.users.find((u) => u.id === userRecords[1]);
      if (!target) throw error(404, '账号不存在');
      return send(res, 200, {
        user: safeUser(target),
        learning: memberProgress(db, target, { details: true }),
        submissions: db.submissions
          .filter((s) => s.userId === target.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((s) => ({
            ...s,
            archived: !db.lessons.some((l) => l.id === s.lessonId)
          }))
      });
    }
    if (path === '/api/admin/users' && method === 'GET')
      return send(res, 200, {
        users: db.users.map((u) => ({
          ...safeUser(u),
          learning: memberProgress(db, u)
        }))
      });
    if (path === '/api/admin/users' && method === 'POST') {
      const input = await body(req),
        username = String(input.username || '').trim();
      if (!/^[\w]{3,20}$/.test(username))
        throw error(400, '用户名需为 3–20 位字母、数字或下划线');
      if (
        db.users.some(
          (u) => u.username.toLowerCase() === username.toLowerCase()
        )
      )
        throw error(409, '用户名已存在');
      if (
        typeof input.password !== 'string' ||
        input.password.length < 6 ||
        input.password.length > 200
      )
        throw error(400, '密码长度应为 6–200 位');
      const created = {
        id: randomUUID(),
        username,
        displayName: String(input.displayName || username).slice(0, 30),
        role: input.role === 'admin' ? 'admin' : 'member',
        active: true,
        passwordHash: hash(input.password),
        createdAt: now()
      };
      if (created.role === 'admin' && !user.owner)
        throw error(403, '只有 Owner 可以授予管理员权限');
      db.users.push(created);
      await save();
      return send(res, 201, { user: safeUser(created) });
    }
    if (
      parts[2] === 'admin' &&
      parts[3] === 'users' &&
      parts[4] &&
      method === 'PATCH'
    ) {
      const target = db.users.find((u) => u.id === parts[4]),
        input = await body(req);
      if (!target) throw error(404, '账号不存在');
      if (target.owner) throw error(403, 'Owner 账号不可通过管理台修改');
      if (target.role === 'admin' && !user.owner)
        throw error(403, '仅 Owner 可以管理其他管理员账号');
      if (input.role === 'admin' && !user.owner)
        throw error(403, '只有 Owner 可以授予管理员权限');
      if (
        target.id === user.id &&
        (input.active === false || input.role === 'member')
      )
        throw error(400, '不能停用或降级当前管理员');
      if (
        input.password &&
        (typeof input.password !== 'string' ||
          input.password.length < 6 ||
          input.password.length > 200)
      )
        throw error(400, '密码长度应为 6–200 位');
      if (typeof input.active === 'boolean') target.active = input.active;
      if (['admin', 'member'].includes(input.role)) target.role = input.role;
      if (input.password) target.passwordHash = hash(input.password);
      db.sessions = db.sessions.filter((s) => s.userId !== target.id);
      await save();
      return send(res, 200, { user: safeUser(target) });
    }
    return false;
  };
}
