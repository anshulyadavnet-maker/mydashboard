import type { APIRoute } from 'astro';
import { getDB, getUserByEmail, createPasswordReset } from '../../../lib/db';

export const POST: APIRoute = async (context) => {
  const { request } = context;
  try {
    const { email } = await request.json();
    if (!email) {
      return new Response(JSON.stringify({ success: false, message: 'Email is required.' }), { status: 400 });
    }

    const db = getDB(context);
    const user = await getUserByEmail(db, email);

    if (!user) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'No account found with this email address.' 
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate a 6-digit numeric reset token
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes expiry

    await createPasswordReset(db, email, token, expiresAt);

    // Retrieve Resend API key from global/process variables
    const apiKey = 
      (globalThis as any).RESEND_API_KEY ||
      (typeof process !== 'undefined' && process.env?.RESEND_API_KEY);

    let emailSent = false;
    let emailError = null;

    if (apiKey) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'MYDASHBOARD <noreply@mydashboard.co.in>',
            to: [email],
            subject: 'Reset Your Password - MYDASHBOARD.CO.IN',
            html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #ffffff;">
                <h2 style="color: #0f766e; margin-top: 0;">Password Reset Verification</h2>
                <p style="color: #374151; font-size: 1rem; line-height: 1.5;">You requested a password reset for your MYDASHBOARD.CO.IN account. Use the following 6-digit verification code to reset your password:</p>
                <div style="text-align: center; margin: 30px 0;">
                  <span style="font-size: 2rem; font-weight: bold; letter-spacing: 0.15em; color: #0d9488; background-color: #f0fdfa; padding: 12px 24px; border: 1px solid #ccfbf1; border-radius: 6px; display: inline-block;">
                    ${token}
                  </span>
                </div>
                <p style="color: #4b5563; font-size: 0.875rem; line-height: 1.5;">This verification code is valid for 15 minutes. If you did not make this request, you can safely ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                <p style="color: #9ca3af; font-size: 0.75rem; text-align: center; margin: 0;">MYDASHBOARD.CO.IN &mdash; Manage everything, one dashboard.</p>
              </div>
            `,
            text: `Password Reset Verification Code: ${token}\n\nThis verification code is valid for 15 minutes. If you did not make this request, you can safely ignore this email.\n\nMYDASHBOARD.CO.IN`
          })
        });

        if (res.ok) {
          emailSent = true;
          console.log(`[AUTH] Resend API successfully sent email to ${email}.`);
        } else {
          const errBody = await res.json().catch(() => ({}));
          emailError = errBody.message || `HTTP ${res.status}`;
          console.error(`[AUTH] Resend API failed: ${JSON.stringify(errBody)}`);
        }
      } catch (err: any) {
        emailError = err.message;
        console.error(`[AUTH] Error calling Resend API: ${err.message}`);
      }
    } else {
      console.warn(`[AUTH] RESEND_API_KEY environment variable is not defined.`);
    }

    // Log the token in the server console for debugging/local testing
    console.log(`[AUTH] Password reset requested for ${email}. Dev token: ${token}`);

    const isDev = import.meta.env.DEV;

    // In production, if email sending fails, we must return success: false so the user knows it failed.
    if (!emailSent && !isDev) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Failed to send password reset email. Please contact support or check if the email service is configured.' 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: emailSent 
        ? 'A password reset code has been sent to your email.' 
        : 'Reset code generated (Local Dev Mode).',
      devCode: isDev && !emailSent ? token : undefined, // Only return devCode in local dev when email fails
      emailSent,
      emailError: isDev ? emailError : undefined // Only return detailed error stack in dev mode
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: 'Server error: ' + err.message }), { status: 500 });
  }
};
