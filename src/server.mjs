import { join, resolve } from 'node:path';
import { listenGuard } from './listen-guard.mjs';
import { productionPort } from './service-config.mjs';
import { initJudge, engine } from './judge.mjs';
import { courseService } from './course-structure.mjs';
import { materialService } from './materials.mjs';
import { body, send, error } from './http-response.mjs';
import { serveStatic } from './static-files.mjs';
import { openStore } from './store.mjs';
import { learningStore } from './learning-store.mjs';
import { accountService } from './routes/accounts.mjs';
import { adminRoutes } from './routes/admin.mjs';
import { exerciseRoutes } from './routes/exercises.mjs';
import { learningRoutes } from './routes/learning.mjs';
import { workbenchRoutes } from './routes/workbench.mjs';
import { root, dataDirectory } from './runtime-config.mjs';

const dataDir = dataDirectory;
const publicDir = join(root, 'public');
let port = Number(process.env.PORT || productionPort),
  ready = false;
export const server = await listenGuard(port, (req, res) => {
  if (ready) return handleRequest(req, res);
  res.setHeader('Retry-After', '5');
  send(res, 503, { error: '课程网站正在启动，请稍后重试' });
});
port = server.address().port;
const { db, save, waitForSave, flushScheduledCourses } =
  await openStore(dataDir);
const accounts = accountService({ db, save, waitForSave, dataDir });
const learning = learningStore(db);
const dependencies = { db, save, ...accounts, ...learning };
const exercises = exerciseRoutes(dependencies);
const workbench = workbenchRoutes(dependencies);
const lessons = learningRoutes({
  ...dependencies,
  ensureAttemptAvailable: exercises.ensureAttemptAvailable
});
const admin = adminRoutes(dependencies);
const courses = courseService({ ...dependencies, body, send });
const materials = materialService({
  root,
  courseDir: resolve(process.env.FP_COURSE_DIR || join(root, 'course')),
  dataDir,
  db,
  save,
  body,
  send
});
await initJudge();

const publicAccountPaths = new Set(['/api/auth/login', '/api/auth/register']);
async function api(req, res, url) {
  await flushScheduledCourses();
  const { pathname: path } = url,
    { method } = req;
  if (path === '/api/health' && method === 'GET')
    return send(res, 200, {
      name: 'FabulousProgram',
      serviceId: process.env.FP_SERVICE_ID || null,
      engine
    });
  if (publicAccountPaths.has(path) && method === 'POST')
    return accounts.handle(req, res, url);
  const user = accounts.auth(req);
  if (
    (await materials(req, res, url, user)) ||
    (await courses(req, res, url, user))
  )
    return;
  if (path.startsWith('/api/auth/') && method === 'POST')
    return accounts.handle(req, res, url, user);
  if (path.startsWith('/api/admin/')) {
    if ((await admin(req, res, url, user)) !== false) return;
  } else {
    for (const handle of [workbench, lessons, exercises.handle]) {
      if ((await handle(req, res, url, user)) !== false) return;
    }
  }
  throw error(404, '接口不存在');
}

async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:' + port);
    const origin = req.headers.origin;
    if (origin) {
      let sameHost = false;
      try {
        sameHost = new URL(origin).host === req.headers.host;
      } catch {}
      if (
        !sameHost &&
        !['http://127.0.0.1:' + port, 'http://localhost:' + port].includes(
          origin
        )
      )
        throw error(403, '不允许跨站请求');
    }
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    await serveStatic(req, res, url, publicDir);
  } catch (e) {
    if (!res.headersSent) send(res, e.code || 500, { error: e.message });
    else res.end();
  }
}
ready = true;
console.log(
  `FabulousProgram · http://127.0.0.1:${port}\n${engine.label}\nData: ${dataDir}`
);
const publicationTimer = setInterval(() => {
  flushScheduledCourses().catch(console.error);
}, 1000);
publicationTimer.unref();
server.on('close', () => clearInterval(publicationTimer));
