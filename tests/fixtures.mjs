import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hashPassword } from '../src/identity.mjs';

export async function seedTestAccounts(data) {
  const users = [
    { id: 'u_admin', username: 'admin', role: 'admin', password: 'admin123' },
    { id: 'u_member', username: 'member', role: 'member', password: 'member123' },
  ].map(({ password, ...account }) => ({
    ...account,
    active: true,
    displayName: account.username,
    passwordHash: hashPassword(password),
    createdAt: new Date(0).toISOString(),
  }));
  await writeFile(join(data, 'store.json'), JSON.stringify({ users, lessons: [], progress: [], submissions: [] }), { flag: 'wx', mode: 0o600 });
}
