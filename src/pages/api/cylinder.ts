import type { APIRoute } from 'astro';
import { getDB, createCylinder, updateCylinder, connectCylinder, deleteCylinder } from '../../lib/db';

export const POST: APIRoute = async (context) => {
  const { request, locals } = context;
  const user = (locals as any).user;
  if (!user) return new Response(JSON.stringify({ success: false, message: 'Unauthorized.' }), { status: 401 });
  
  const db = getDB(context);
  const data = await request.json();
  const { action, id, provider, booking_number, booking_date, delivery_date, start_date, empty_date, price, subsidy, weight, status, placement_id, notes, placementId, connectDate, emptyDate } = data;
  
  try {
    if (action === 'create') {
      const cylinderId = await createCylinder(db, user.userId, {
        provider,
        booking_number,
        booking_date,
        delivery_date,
        start_date,
        empty_date,
        price: parseFloat(price) || 0,
        subsidy: parseFloat(subsidy) || 0,
        weight: parseFloat(weight) || 14.2,
        status,
        placement_id: placement_id ? parseInt(placement_id) : null,
        notes
      });
      return new Response(JSON.stringify({ success: true, id: cylinderId }));
    } else if (action === 'update') {
      await updateCylinder(db, id, user.userId, {
        provider,
        booking_number,
        booking_date,
        delivery_date,
        start_date,
        empty_date,
        price: parseFloat(price) || 0,
        subsidy: parseFloat(subsidy) || 0,
        weight: parseFloat(weight) || 14.2,
        status,
        placement_id: placement_id ? parseInt(placement_id) : null,
        notes
      });
      return new Response(JSON.stringify({ success: true }));
    } else if (action === 'connect') {
      const connDate = connectDate || new Date().toISOString().split('T')[0];
      await connectCylinder(db, id, parseInt(placementId), user.userId, connDate);
      return new Response(JSON.stringify({ success: true }));
    } else if (action === 'markEmpty') {
      // Find the cylinder, update its status to empty and empty_date to emptyDate
      const empDate = emptyDate || new Date().toISOString().split('T')[0];
      
      // We can use a direct D1 run or fetch and update. Direct is cleaner:
      await db.prepare(`
        UPDATE cylinders SET status = 'empty', empty_date = ?, updated_at = datetime('now')
        WHERE id = ? AND user_id = ?
      `).bind(empDate, id, user.userId).run();
      
      return new Response(JSON.stringify({ success: true }));
    } else if (action === 'delete') {
      await deleteCylinder(db, id, user.userId);
      return new Response(JSON.stringify({ success: true }));
    }
    return new Response(JSON.stringify({ success: false, message: 'Invalid action' }), { status: 400 });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};
