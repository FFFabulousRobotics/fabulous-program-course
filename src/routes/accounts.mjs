import { randomBytes, randomUUID } from 'node:crypto';
import {
  hashPassword as hash,
  passwordMatches,
  safeUser,
  tokenDigest
} from '../identity.mjs';
import { closeOwnerSimulations, closeUserSimulations } from '../beta.mjs';
import { previewSessionHash, revokePreviewAccess } from '../preview-access.mjs';
import {
  removeAccountData,
  purgeAccountBackups
} from '../account-deletion.mjs';
import { body, send, error, now } from '../http-response.mjs';

export function accountService({ db, save, waitForSave, dataDir }) {
  const deletingUsers = new Set(),
    userJobs = new Map();
  let deletionQueue = Promise.resolve();
  async function trackUserJob(userId, job) {
    const jobs = userJobs.get(userId) || new Set();
    userJobs.set(userId, jobs);
    jobs.add(job);
    try {
      return await job;
    } finally {
      jobs.delete(job);
      if (!jobs.size) userJobs.delete(userId);
    }
  }
  function auth(req, role) {
    const token = String(req.headers.authorization || '').replace(
      /^Bearer /,
      ''
    );
    const digest = /^[a-f0-9]{64}$/.test(token)
      ? tokenDigest(token)
      : !req.headers.authorization
        ? previewSessionHash(req)
        : null;
    if (!digest) throw error(401, '请登录 FabulousProgram');
    const session = db.sessions.find(
      (s) => s.hash === digest && s.expires > Date.now()
    );
    const user =
      session && db.users.find((u) => u.id === session.userId && u.active);
    if (!user || deletingUsers.has(user.id))
      throw error(401, '登录已失效，请重新登录');
    if (role && user.role !== role) throw error(403, '仅管理员可以执行此操作');
    if (
      user.role === 'member' &&
      Date.now() - (Date.parse(user.lastActiveAt) || 0) > 60000
    ) {
      user.lastActiveAt = now();
      save().catch(console.error);
    }
    return user;
  }
  const attempts = new Map();
  const registrations = new Map();
  async function handle(req, res, url, user) {
    const { pathname: path } = url,
      { method } = req;
    if (path === '/api/auth/register' && method === 'POST') {
      const input = await body(req),
        key = req.socket.remoteAddress;
      for (const [k, v] of registrations)
        if (v.until < Date.now()) registrations.delete(k);
      const limit = registrations.get(key) || {
        count: 0,
        until: Date.now() + 900000
      };
      if (limit.count >= 10) throw error(429, '注册尝试过多，请 15 分钟后重试');
      limit.count++;
      registrations.set(key, limit);
      const username = String(input.username || '').trim(),
        displayName = String(input.displayName || '').trim();
      if (!/^[A-Za-z0-9_]{3,20}$/.test(username))
        throw error(400, '用户名需为 3–20 位字母、数字或下划线');
      if (!displayName || displayName.length > 30)
        throw error(400, '姓名需为 1–30 个字符');
      if (
        typeof input.password !== 'string' ||
        input.password.length < 10 ||
        input.password.length > 200
      )
        throw error(400, '密码长度应为 10–200 位');
      if (
        db.users.some(
          (u) => u.username.toLowerCase() === username.toLowerCase()
        )
      )
        throw error(409, '用户名已存在');
      const created = {
        id: randomUUID(),
        username,
        displayName,
        role: 'member',
        active: true,
        passwordHash: hash(input.password),
        createdAt: now()
      };
      db.users.push(created);
      await save();
      return send(res, 201, { user: safeUser(created) });
    }
    if (path === '/api/auth/login' && method === 'POST') {
      const data = await body(req),
        key = req.socket.remoteAddress;
      const attempt = attempts.get(key) || {
        count: 0,
        until: Date.now() + 60000
      };
      if (attempt.until < Date.now()) {
        attempt.count = 0;
        attempt.until = Date.now() + 60000;
      }
      if (attempt.count >= 20) throw error(429, '登录尝试过多，请一分钟后重试');
      if (typeof data.password !== 'string' || data.password.length > 200)
        throw error(400, '密码格式错误');
      const user = db.users.find(
        (u) =>
          u.username.toLowerCase() ===
            String(data.username).trim().toLowerCase() &&
          u.active &&
          !deletingUsers.has(u.id)
      );
      if (!user || !passwordMatches(data.password, user.passwordHash)) {
        attempt.count++;
        attempts.set(key, attempt);
        throw error(401, '用户名或密码错误');
      }
      attempts.delete(key);
      user.lastActiveAt = now();
      const token = randomBytes(32).toString('hex');
      db.sessions = db.sessions.filter((s) => s.expires > Date.now());
      db.sessions.push({
        hash: tokenDigest(token),
        userId: user.id,
        expires: Date.now() + 43200000
      });
      await save();
      // No shared browser cookie: each tab sends its own explicit session token.
      res.setHeader(
        'Set-Cookie',
        'rj_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
      );
      return send(res, 200, { user: safeUser(user), token });
    }
    if (path === '/api/auth/logout' && method === 'POST') {
      const digest = tokenDigest(req.headers.authorization.slice(7));
      await closeOwnerSimulations(digest);
      db.sessions = db.sessions.filter((s) => s.hash !== digest);
      await save();
      return send(res, 200, { ok: true });
    }
    if (path === '/api/auth/profile' && method === 'POST') {
      const input = await body(req);
      auth(req);
      const patch = {};
      if (input.displayName !== undefined) {
        const displayName = String(input.displayName).trim();
        if (!displayName || displayName.length > 30)
          throw error(400, '姓名需为 1–30 个字符');
        patch.displayName = displayName;
      }
      if (input.username !== undefined) {
        const username = String(input.username).trim();
        if (!/^[A-Za-z0-9_]{3,20}$/.test(username))
          throw error(400, '用户名需为 3–20 位字母、数字或下划线');
        if (
          db.users.some(
            (u) =>
              u.id !== user.id &&
              u.username.toLowerCase() === username.toLowerCase()
          )
        )
          throw error(409, '用户名已被占用');
        patch.username = username;
      }
      if (!Object.keys(patch).length) throw error(400, '没有需要修改的内容');
      Object.assign(user, patch);
      await save();
      return send(res, 200, { user: safeUser(user) });
    }
    if (path === '/api/auth/password' && method === 'POST') {
      const input = await body(req);
      auth(req);
      if (
        typeof input.oldPassword !== 'string' ||
        typeof input.newPassword !== 'string'
      )
        throw error(400, '密码格式错误');
      if (input.newPassword.length < 10 || input.newPassword.length > 200)
        throw error(400, '新密码长度应为 10–200 位');
      if (!passwordMatches(input.oldPassword, user.passwordHash))
        throw error(401, '当前密码不正确');
      user.passwordHash = hash(input.newPassword);
      await save();
      return send(res, 200, { ok: true });
    }
    if (path === '/api/auth/deactivate' && method === 'POST') {
      throw error(
        409,
        '注销流程已更新，请刷新页面后确认永久删除账户及全部个人数据'
      );
    }
    if (path === '/api/auth/delete' && method === 'POST') {
      const input = await body(req);
      auth(req);
      if (input.confirmation !== 'DELETE_ALL_DATA')
        throw error(400, '请确认永久删除账户及全部个人数据');
      if (
        typeof input.password !== 'string' ||
        input.password.length > 200 ||
        !passwordMatches(input.password, user.passwordHash)
      )
        throw error(400, '当前密码不正确');
      if (user.owner) throw error(400, 'Owner 账号不支持注销');
      if (
        user.role === 'admin' &&
        db.users.filter(
          (u) => u.role === 'admin' && u.active && !deletingUsers.has(u.id)
        ).length <= 1
      )
        throw error(400, '至少保留一名启用的管理员');
      deletingUsers.add(user.id);
      const deletion = deletionQueue
        .catch(() => {})
        .then(async () => {
          await Promise.allSettled([...(userJobs.get(user.id) || [])]);
          await closeUserSimulations(user.id);
          await waitForSave();
          await purgeAccountBackups(dataDir, user.id);
          revokePreviewAccess(
            db.sessions.filter((s) => s.userId === user.id).map((s) => s.hash),
            user.id
          );
          removeAccountData(db, user.id);
          await save();
        });
      deletionQueue = deletion;
      try {
        await deletion;
      } finally {
        deletingUsers.delete(user.id);
      }
      return send(res, 200, { ok: true, deleted: true });
    }
    throw error(404, '接口不存在');
  }
  return { auth, trackUserJob, handle };
}
