import { backendLabel, tunnelLabel, pinTunnelOrigin, probeBackend, recoveryDecision } from './service-config.mjs';

export async function watchdogCycle({ previous = {}, loaded, restart, readTunnel, writeTunnel, probe = probeBackend, log = () => {}, now = Date.now() }) {
  // Respect intentional maintenance: do not bootstrap an unloaded service.
  if (!await loaded(backendLabel)) return null;
  const health = await probe();
  const next = recoveryDecision(previous, health.ok, now);
  if (!health.ok && !previous.failures) log(`后台异常：${health.reason}；连续三次失败后重启本站服务`);
  if (health.ok && previous.failures) log('课程后台已恢复');
  if (next.restart) {
    try { await restart(backendLabel); log(`已重启课程后台（连续 ${next.failures} 次检查失败）`); }
    catch (e) { log(`后台重启失败：${e.message}`); }
  }
  if (health.ok && await loaded(tunnelLabel)) {
    const before = await readTunnel();
    const after = pinTunnelOrigin(before);
    if (after !== before) {
      await writeTunnel(after);
      await restart(tunnelLabel);
      log('已纠正课程域名的转发地址并重启课程 Tunnel');
    }
  }
  return { ...next, checkedAt: new Date(now).toISOString(), healthy: health.ok };
}
