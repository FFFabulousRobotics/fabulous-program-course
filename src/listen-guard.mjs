import http from 'node:http';

// Reserve the actual socket before reading, migrating or writing the database.
export async function listenGuard(port, handler) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('PORT 必须是 0–65535 的整数');
  const server = http.createServer(handler);
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
    });
  } catch (cause) {
    if (cause.code === 'EADDRINUSE') throw new Error(`课程网站启动已停止：127.0.0.1:${port} 被占用；本次未读写账号或成绩。请检查占用进程，或为独立测试指定 PORT 和 FP_DATA_DIR。`, { cause });
    throw cause;
  }
  return server;
}
