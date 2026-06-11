import type { APIRoute } from 'astro';
import { getDB, createPassword, updatePassword, deletePassword } from '../../lib/db';

export const POST: APIRoute = async (context) => {
  const { request, locals } = context;
  const user = (locals as any).user;
  if (!user) return new Response(JSON.stringify({ success: false, message: 'Unauthorized.' }), { status: 401 });
  
  const db = getDB(context);
  const data = await request.json();
  const { action, id, ...details } = data;
  
  try {
    if (action === 'create') {
      const passwordId = await createPassword(db, user.userId, details);
      return new Response(JSON.stringify({ success: true, id: passwordId }));
    } else if (action === 'update') {
      await updatePassword(db, id, user.userId, details);
      return new Response(JSON.stringify({ success: true }));
    } else if (action === 'delete') {
      await deletePassword(db, id, user.userId);
      return new Response(JSON.stringify({ success: true }));
    }
    return new Response(JSON.stringify({ success: false, message: 'Invalid action' }), { status: 400 });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};
