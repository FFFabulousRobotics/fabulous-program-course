export const productionPort = 19726;
export const productionOrigin = `http://127.0.0.1:${productionPort}`;
export const productionServiceId = 'program-course-production';
export const backendLabel = 'top.fffabulous.program-backend';
export const tunnelLabel = 'top.fffabulous.program-tunnel';
export const watchdogLabel = 'top.fffabulous.program-watchdog';

// Change only this hostname's origin; leave other routes and credentials intact.
export function pinTunnelOrigin(config) {
  const lines = config.split('\n');
  const hosts = lines.flatMap((line, i) => /^\s*-\s*hostname:\s*program\.fffabulous\.top\s*$/.test(line) ? [i] : []);
  if (hosts.length !== 1) throw Error('Tunnel 中必须恰好有一个 program.fffabulous.top 路由');
  const services = [];
  for (let i = hosts[0] + 1; i < lines.length && !/^\s*-\s/.test(lines[i]); i++) {
    if (/^\s+service:/.test(lines[i])) services.push(i);
  }
  if (services.length !== 1) throw Error('无法安全定位课程网站的 Tunnel 转发地址');
  const i = services[0];
  lines[i] = lines[i].replace(/service:.*$/, `service: ${productionOrigin}`);
  return lines.join('\n');
}

export async function probeBackend(origin = productionOrigin, timeoutMs = 5000) {
  try {
    const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
    if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };
    const body = await response.json();
    return body.name === 'FabulousProgram' && body.serviceId === productionServiceId
      ? { ok: true }
      : { ok: false, reason: '端口响应的服务身份不匹配' };
  } catch (e) {
    return { ok: false, reason: e.name === 'TimeoutError' ? '健康检查超时' : '课程后台连接失败' };
  }
}

export function recoveryDecision(previous = {}, healthy, now = Date.now()) {
  const failures = healthy ? 0 : (previous.failures || 0) + 1;
  const restart = failures >= 3 && now - (previous.lastRestart || 0) >= 300000;
  return { failures, lastRestart: restart ? now : previous.lastRestart || 0, restart };
}
