import type { APIRoute } from 'astro';
import { getDB, getPasswordReset, deletePasswordReset, updateUserPassword } from '../../../lib/db';
import { hashPassword } from '../../../lib/auth';

export const POST: APIRoute = async (context) => {
  const { request } = context;
  try {
    const { email, token, password } = await request.json();
    if (!email || !token || !password) {
      return new Response(
        JSON.stringify({ success: false, message: 'Email, code, and new password are required.' }), 
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, message: 'Password must be at least 6 characters long.' }), 
        { status: 400 }
      );
    }

    const db = getDB(context);
    const resetRequest = await getPasswordReset(db, email, token);

    if (!resetRequest) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid or expired reset code.' }), 
        { status: 400 }
      );
    }

    // Check expiration
    const expiresAt = new Date(resetRequest.expires_at as string);
    if (new Date() > expiresAt) {
      // Clean up expired token
      await deletePasswordReset(db, email);
      return new Response(
        JSON.stringify({ success: false, message: 'Reset code has expired. Please request a new one.' }), 
        { status: 400 }
      );
    }

    // Hash the new password and update user record
    const passwordHash = await hashPassword(password);
    const updated = await updateUserPassword(db, email, passwordHash);

    if (updated === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to update password. User may not exist.' }), 
        { status: 500 }
      );
    }

    // Clean up reset token on successful reset
    await deletePasswordReset(db, email);

    return new Response(
      JSON.stringify({ success: true, message: 'Password has been reset successfully. Redirecting to login...' }), 
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: 'Server error: ' + err.message }), { status: 500 });
  }
};
