export const now = () => new Date().toISOString();
export const error = (code, message) =>
  Object.assign(new Error(message), { code });
export async function body(req) {
  if (!String(req.headers['content-type']).startsWith('application/json'))
    throw error(415, '请求需为 JSON');
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 300000) throw error(413, '请求过大');
  }
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw error(400, 'JSON 格式错误');
  }
}
export function send(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(payload));
}
