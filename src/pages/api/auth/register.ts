import type { APIRoute } from 'astro';
import { getDB, getUserByEmail, createUser } from '../../../lib/db';
import { hashPassword, createToken, createCookieHeader } from '../../../lib/auth';

export const POST: APIRoute = async (context) => {
  const { request, locals } = context;
  try {
    const { email, password, name } = await request.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ success: false, message: 'Email and password are required.' }), { status: 400 });
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ success: false, message: 'Password must be at least 6 characters.' }), { status: 400 });
    }
    const db = getDB(context);
    const existing = await getUserByEmail(db, email);
    if (existing) {
      return new Response(JSON.stringify({ success: false, message: 'An account with this email already exists.' }), { status: 409 });
    }
    const passwordHash = await hashPassword(password);
    const userId = await createUser(db, email, passwordHash, name || '');
    if (!userId) {
      return new Response(JSON.stringify({ success: false, message: 'Failed to create account.' }), { status: 500 });
    }
    const token = await createToken({
      userId: userId as number,
      email,
      name: name || '',
    });
    const cookie = createCookieHeader(token);
    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: { 'Set-Cookie': cookie, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: 'Server error: ' + err.message }), { status: 500 });
  }
};