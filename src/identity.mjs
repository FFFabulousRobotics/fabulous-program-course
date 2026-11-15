import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash
} from 'node:crypto';

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function passwordMatches(password, encoded) {
  const [salt, value] = encoded.split(':');
  const actual = scryptSync(password, salt, 64),
    expected = Buffer.from(value, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export const safeUser = ({ passwordHash, ...user }) => user;
export const tokenDigest = (token) =>
  createHash('sha256').update(token).digest('hex');
