import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

function getSecretKey(): Uint8Array {
  // In Cloudflare Workers/Pages, env vars are on globalThis
  // In wrangler pages dev, wrangler.toml [vars] are injected as globals
  const secret: string =
    (globalThis as any).JWT_SECRET ||
    (typeof process !== 'undefined' && process.env?.JWT_SECRET) ||
    'dev-secret-change-me-in-production-abc123xyz';
  return new TextEncoder().encode(secret);
}

const COOKIE_NAME = 'milk_token';
const JWT_EXPIRY = '30d';

export interface UserPayload {
  userId: number;
  email: string;
  name?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(payload: UserPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(getSecretKey());
}

export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as UserPayload;
  } catch {
    return null;
  }
}

export function getTokenFromCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split('=');
    if (name === COOKIE_NAME) return rest.join('=');
  }
  return null;
}

export function createCookieHeader(token: string, maxAge: number = 60 * 60 * 24 * 30): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export function clearCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

export { COOKIE_NAME };
