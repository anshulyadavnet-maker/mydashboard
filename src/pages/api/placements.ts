import type { APIRoute } from 'astro';
import { getDB, createPlacement, updatePlacement, deletePlacement } from '../../lib/db';

export const POST: APIRoute = async (context) => {
  const { request, locals } = context;
  const user = (locals as any).user;
  if (!user) return new Response(JSON.stringify({ success: false, message: 'Unauthorized.' }), { status: 401 });
  
  const db = getDB(context);
  const data = await request.json();
  const { action, id, name, estimatedDays } = data;
  
  try {
    if (action === 'create') {
      const placementId = await createPlacement(db, user.userId, name, parseInt(estimatedDays) || 45);
      return new Response(JSON.stringify({ success: true, id: placementId }));
    } else if (action === 'update') {
      await updatePlacement(db, id, user.userId, name, parseInt(estimatedDays) || 45);
      return new Response(JSON.stringify({ success: true }));
    } else if (action === 'delete') {
      await deletePlacement(db, id, user.userId);
      return new Response(JSON.stringify({ success: true }));
    }
    return new Response(JSON.stringify({ success: false, message: 'Invalid action' }), { status: 400 });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};
