import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { getLocalDateString } from '../../lib/milk';
import {
  getNewspaperAccountById,
  createNewspaperAccount,
  updateNewspaperAccount,
  deleteNewspaperAccount,
  upsertNewspaperEntry,
  bulkSetNewspaperStatus,
  createNewspaperPayment,
  deleteNewspaperPayment
} from '../../lib/db';

export const POST: APIRoute = async (context) => {
  const { request, locals } = context;
  const user = (locals as any).user;
  if (!user) {
    return new Response(JSON.stringify({ success: false, message: 'Unauthorized.' }), { status: 401 });
  }
  const db = getDB(context);
  let formData: FormData;
  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      formData = await request.formData();
    } else if (contentType.includes('application/json')) {
      const json = await request.json();
      formData = new FormData();
      for (const [key, value] of Object.entries(json)) {
        formData.append(key, String(value));
      }
    } else {
      formData = await request.formData();
    }
  } catch {
    return new Response(JSON.stringify({ success: false, message: 'Invalid request body.' }), { status: 400 });
  }

  const action = formData.get('action') as string;

  try {
    switch (action) {
      case 'add_or_edit_account': {
        const accountId = parseInt(formData.get('account_id') as string) || 0;
        const name = (formData.get('name') as string)?.trim();
        const rateWeekday = parseFloat(formData.get('rate_weekday') as string) || 0;
        const rateSunday = parseFloat(formData.get('rate_sunday') as string) || 0;
        const active = formData.get('active') === '1' || formData.get('active') === 'on' || formData.get('active') === 'true' ? 1 : 0;
        const startDate = (formData.get('start_date') as string) || '';
        const endDate = (formData.get('end_date') as string) || '';

        if (!name) {
          return new Response(JSON.stringify({ success: false, message: 'Newspaper name is required.' }), { status: 400 });
        }
        if (rateWeekday < 0 || rateSunday < 0) {
          return new Response(JSON.stringify({ success: false, message: 'Rates must be positive numbers.' }), { status: 400 });
        }

        if (accountId > 0) {
          // Check ownership
          const existing = await getNewspaperAccountById(db, accountId, user.userId);
          if (!existing) {
            return new Response(JSON.stringify({ success: false, message: 'Account not found.' }), { status: 404 });
          }
          await updateNewspaperAccount(db, accountId, user.userId, {
            name, rate_weekday: rateWeekday, rate_sunday: rateSunday,
            active, start_date: startDate, end_date: endDate
          });
        } else {
          const newAccountId = await createNewspaperAccount(db, user.userId, {
            name, rate_weekday: rateWeekday, rate_sunday: rateSunday,
            active, start_date: startDate, end_date: endDate
          });

          if (newAccountId && startDate) {
            const todayStr = getLocalDateString();
            let fillEndStr = todayStr;
            if (endDate) {
              fillEndStr = endDate < todayStr ? endDate : todayStr;
            }
            if (startDate <= fillEndStr) {
              await bulkSetNewspaperStatus(db, newAccountId as number, startDate, fillEndStr, 'delivered', '');
            }
          }
        }
        return new Response(JSON.stringify({ success: true }));
      }

      case 'delete_account': {
        const accountId = parseInt(formData.get('account_id') as string) || 0;
        if (!accountId) {
          return new Response(JSON.stringify({ success: false, message: 'Account ID required.' }), { status: 400 });
        }
        const changes = await deleteNewspaperAccount(db, accountId, user.userId);
        if (!changes) {
          return new Response(JSON.stringify({ success: false, message: 'Account not found or not yours.' }), { status: 404 });
        }
        return new Response(JSON.stringify({ success: true }));
      }

      case 'update_entry': {
        const accountId = parseInt(formData.get('account_id') as string) || 0;
        const entryDate = formData.get('entry_date') as string;
        const status = formData.get('status') as string;
        const note = (formData.get('note') as string) || '';

        if (!accountId || !entryDate || !status) {
          return new Response(JSON.stringify({ success: false, message: 'Account, date, and status are required.' }), { status: 400 });
        }
        if (!['delivered', 'skipped', 'vacation'].includes(status)) {
          return new Response(JSON.stringify({ success: false, message: 'Invalid status value.' }), { status: 400 });
        }

        // Verify ownership
        const account = await getNewspaperAccountById(db, accountId, user.userId);
        if (!account) {
          return new Response(JSON.stringify({ success: false, message: 'Account not found or not yours.' }), { status: 404 });
        }

        await upsertNewspaperEntry(db, accountId, entryDate, status, note);
        return new Response(JSON.stringify({ success: true }));
      }

      case 'bulk_suspension': {
        const accountId = parseInt(formData.get('account_id') as string) || 0;
        const startDate = formData.get('start_date') as string;
        const endDate = formData.get('end_date') as string;
        const status = formData.get('status') as string;
        const note = (formData.get('note') as string) || '';

        if (!accountId || !startDate || !endDate || !status) {
          return new Response(JSON.stringify({ success: false, message: 'Account, start date, end date, and status are required.' }), { status: 400 });
        }
        if (!['skipped', 'vacation', 'delivered'].includes(status)) {
          return new Response(JSON.stringify({ success: false, message: 'Invalid status value.' }), { status: 400 });
        }
        if (startDate > endDate) {
          return new Response(JSON.stringify({ success: false, message: 'Start date cannot be after end date.' }), { status: 400 });
        }

        // Verify ownership
        const account = await getNewspaperAccountById(db, accountId, user.userId);
        if (!account) {
          return new Response(JSON.stringify({ success: false, message: 'Account not found or not yours.' }), { status: 404 });
        }

        await bulkSetNewspaperStatus(db, accountId, startDate, endDate, status, note);
        return new Response(JSON.stringify({ success: true }));
      }

      case 'add_payment': {
        const accountId = parseInt(formData.get('account_id') as string) || 0;
        const amount = parseFloat(formData.get('amount') as string) || 0;
        const paymentDate = (formData.get('payment_date') as string) || getLocalDateString();
        const note = (formData.get('note') as string) || '';

        if (!accountId || amount <= 0) {
          return new Response(JSON.stringify({ success: false, message: 'Account ID and valid positive amount are required.' }), { status: 400 });
        }

        // Verify ownership
        const account = await getNewspaperAccountById(db, accountId, user.userId);
        if (!account) {
          return new Response(JSON.stringify({ success: false, message: 'Account not found or not yours.' }), { status: 404 });
        }

        await createNewspaperPayment(db, accountId, amount, paymentDate, note);
        return new Response(JSON.stringify({ success: true }));
      }

      case 'delete_payment': {
        const paymentId = parseInt(formData.get('payment_id') as string) || 0;
        const accountId = parseInt(formData.get('account_id') as string) || 0;

        if (!paymentId || !accountId) {
          return new Response(JSON.stringify({ success: false, message: 'Payment ID and Account ID are required.' }), { status: 400 });
        }

        // Verify ownership
        const account = await getNewspaperAccountById(db, accountId, user.userId);
        if (!account) {
          return new Response(JSON.stringify({ success: false, message: 'Account not found or not yours.' }), { status: 404 });
        }

        const changes = await deleteNewspaperPayment(db, paymentId, accountId);
        if (!changes) {
          return new Response(JSON.stringify({ success: false, message: 'Payment not found.' }), { status: 404 });
        }
        return new Response(JSON.stringify({ success: true }));
      }

      case 'catchup': {
        const accountIdsStr = formData.get('account_ids') as string;
        if (!accountIdsStr) {
          return new Response(JSON.stringify({ success: false, message: 'Account IDs are required.' }), { status: 400 });
        }
        
        const accountIds = accountIdsStr.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
        for (const accountId of accountIds) {
          const account = await getNewspaperAccountById(db, accountId, user.userId);
          if (!account) continue;

          const allDatesStr = formData.get('all_dates_' + accountId) as string;
          const allDates = allDatesStr ? allDatesStr.split(',') : [];
          
          const deliveredDates = formData.getAll('delivered_dates_' + accountId) as string[];

          for (const dateStr of allDates) {
            const status = deliveredDates.includes(dateStr) ? 'delivered' : 'skipped';
            await upsertNewspaperEntry(db, accountId, dateStr, status, '');
          }
        }
        
        return new Response(JSON.stringify({ success: true }));
      }

      default:
        return new Response(JSON.stringify({ success: false, message: 'Unknown action: ' + action }), { status: 400 });
    }
  } catch (err: any) {
    console.error('Newspaper API Error:', err);
    return new Response(JSON.stringify({ success: false, message: 'Server error: ' + err.message }), { status: 500 });
  }
};
