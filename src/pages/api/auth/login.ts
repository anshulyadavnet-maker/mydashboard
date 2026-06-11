import type { APIRoute } from 'astro';
import { getDB, getUserByEmail } from '../../../lib/db';
import { verifyPassword, createToken, createCookieHeader } from '../../../lib/auth';

export const POST: APIRoute = async (context) => {
  const { request, locals } = context;
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ success: false, message: 'Email and password are required.' }), { status: 400 });
    }
    const db = getDB(context);
    const user = await getUserByEmail(db, email);
    if (!user) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid email or password.' }), { status: 401 });
    }
    const valid = await verifyPassword(password, user.password_hash as string);
    if (!valid) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid email or password.' }), { status: 401 });
    }
    const token = await createToken({
      userId: user.id as number,
      email: user.email as string,
      name: user.name as string,
    });
    const cookie = createCookieHeader(token);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Set-Cookie': cookie, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: 'Server error: ' + err.message }), { status: 500 });
  }
};