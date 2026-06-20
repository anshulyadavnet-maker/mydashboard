import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';

export const POST: APIRoute = async (context) => {
  const db = getDB(context);
  
  // Calculate today's date in IST (UTC +5:30)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const dateStr = istDate.toISOString().split('T')[0];

  try {
    await db.prepare(`
      INSERT INTO daily_visitors (visit_date, viewer_count)
      VALUES (?, 1)
      ON CONFLICT(visit_date) DO UPDATE SET viewer_count = viewer_count + 1
    `).bind(dateStr).run();

    return new Response(JSON.stringify({ success: true }));
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 });
  }
};
