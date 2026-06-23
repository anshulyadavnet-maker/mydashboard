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
      if (delivery_date && booking_date && delivery_date < booking_date) {
        return new Response(JSON.stringify({ success: false, message: 'Delivery date cannot be before booking date.' }), { status: 400 });
      }
      if (start_date && booking_date && start_date < booking_date) {
        return new Response(JSON.stringify({ success: false, message: 'Connection date cannot be before booking date.' }), { status: 400 });
      }
      if (start_date && delivery_date && start_date < delivery_date) {
        return new Response(JSON.stringify({ success: false, message: 'Connection date cannot be before delivery date.' }), { status: 400 });
      }
      if (empty_date && start_date && empty_date < start_date) {
        return new Response(JSON.stringify({ success: false, message: 'Empty date cannot be before connection date.' }), { status: 400 });
      }

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
      if (delivery_date && booking_date && delivery_date < booking_date) {
        return new Response(JSON.stringify({ success: false, message: 'Delivery date cannot be before booking date.' }), { status: 400 });
      }
      if (start_date && booking_date && start_date < booking_date) {
        return new Response(JSON.stringify({ success: false, message: 'Connection date cannot be before booking date.' }), { status: 400 });
      }
      if (start_date && delivery_date && start_date < delivery_date) {
        return new Response(JSON.stringify({ success: false, message: 'Connection date cannot be before delivery date.' }), { status: 400 });
      }
      if (empty_date && start_date && empty_date < start_date) {
        return new Response(JSON.stringify({ success: false, message: 'Empty date cannot be before connection date.' }), { status: 400 });
      }

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
      
      const cylinder = await db.prepare('SELECT booking_date, delivery_date FROM cylinders WHERE id = ? AND user_id = ?').bind(id, user.userId).first<any>();
      if (!cylinder) {
        return new Response(JSON.stringify({ success: false, message: 'Cylinder not found.' }), { status: 404 });
      }
      if (cylinder.booking_date && connDate < cylinder.booking_date) {
        return new Response(JSON.stringify({ success: false, message: `Connection date cannot be before booking date (${cylinder.booking_date}).` }), { status: 400 });
      }
      if (cylinder.delivery_date && connDate < cylinder.delivery_date) {
        return new Response(JSON.stringify({ success: false, message: `Connection date cannot be before delivery date (${cylinder.delivery_date}).` }), { status: 400 });
      }

      await connectCylinder(db, id, parseInt(placementId), user.userId, connDate);
      return new Response(JSON.stringify({ success: true }));
    } else if (action === 'markEmpty') {
      const empDate = emptyDate || new Date().toISOString().split('T')[0];
      
      const cylinder = await db.prepare('SELECT booking_date, delivery_date, start_date FROM cylinders WHERE id = ? AND user_id = ?').bind(id, user.userId).first<any>();
      if (!cylinder) {
        return new Response(JSON.stringify({ success: false, message: 'Cylinder not found.' }), { status: 404 });
      }
      if (cylinder.booking_date && empDate < cylinder.booking_date) {
        return new Response(JSON.stringify({ success: false, message: `Empty date cannot be before booking date (${cylinder.booking_date}).` }), { status: 400 });
      }
      if (cylinder.delivery_date && empDate < cylinder.delivery_date) {
        return new Response(JSON.stringify({ success: false, message: `Empty date cannot be before delivery date (${cylinder.delivery_date}).` }), { status: 400 });
      }
      if (cylinder.start_date && empDate < cylinder.start_date) {
        return new Response(JSON.stringify({ success: false, message: `Empty date cannot be before connection date (${cylinder.start_date}).` }), { status: 400 });
      }

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
