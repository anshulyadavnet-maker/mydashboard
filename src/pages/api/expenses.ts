import type { APIRoute } from 'astro';
import { getDB, createExpense, updateExpense, deleteExpense } from '../../lib/db';

export const POST: APIRoute = async (context) => {
  const { request, locals } = context;
  const user = (locals as any).user;
  if (!user) return new Response(JSON.stringify({ success: false, message: 'Unauthorized.' }), { status: 401 });
  
  const db = getDB(context);
  const data = await request.json();
  const { action, id, amount, category, note, date, color } = data;
  
  try {
    if (action === 'create') {
      const expenseId = await createExpense(db, user.userId, amount, category, note, date, color);
      return new Response(JSON.stringify({ success: true, id: expenseId }));
    } else if (action === 'update') {
      await updateExpense(db, id, user.userId, amount, category, note, date, color);
      return new Response(JSON.stringify({ success: true }));
    } else if (action === 'delete') {
      await deleteExpense(db, id, user.userId);
      return new Response(JSON.stringify({ success: true }));
    }
    return new Response(JSON.stringify({ success: false, message: 'Invalid action' }), { status: 400 });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};
