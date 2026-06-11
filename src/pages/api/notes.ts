import type { APIRoute } from 'astro';
import { getDB, createNote, updateNote, deleteNote } from '../../lib/db';

export const POST: APIRoute = async (context) => {
  const { request, locals } = context;
  const user = (locals as any).user;
  if (!user) return new Response(JSON.stringify({ success: false, message: 'Unauthorized.' }), { status: 401 });
  
  const db = getDB(context);
  const data = await request.json();
  const { action, id, content, color, tags } = data;
  
  try {
    if (action === 'create') {
      const noteId = await createNote(db, user.userId, content, color, tags || []);
      return new Response(JSON.stringify({ success: true, id: noteId }));
    } else if (action === 'update') {
      await updateNote(db, id, user.userId, content, color, tags || []);
      return new Response(JSON.stringify({ success: true }));
    } else if (action === 'delete') {
      await deleteNote(db, id, user.userId);
      return new Response(JSON.stringify({ success: true }));
    }
    return new Response(JSON.stringify({ success: false, message: 'Invalid action' }), { status: 400 });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};
