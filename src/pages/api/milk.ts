import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { getLocalDateString } from '../../lib/milk';
import {
  createSupplier, deleteSupplier, getSupplierByName,
  createAccount, updateAccount, deleteAccount, checkAccountExists,
  getAccountById, getLastConfig,
  upsertEntry, bulkAutofill,
  createPayment, updatePayment, deletePayment,
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
        const supplierId = parseInt(formData.get('supplier_id') as string) || 0;
        const newSupplierName = (formData.get('milksupplier_name') as string)?.trim();
        const categoryId = parseInt(formData.get('category_id') as string) || 0;
        const rate = parseFloat(formData.get('rate') as string) || 0;
        const autogenQuantity = parseFloat(formData.get('autogen_quantity') as string) || 0;
        const autogenDaily = autogenQuantity > 0 ? 1 : 0;
        const autogenTime = (formData.get('autogen_time') as string) || '07:30';
        const active = formData.get('active') === '1' || formData.get('active') === 'on' ? 1 : 0;
        const startDate = (formData.get('start_date') as string) || '';
        const endDate = (formData.get('end_date') as string) || '';
        const month = parseInt(formData.get('month') as string) || 0;
        const year = parseInt(formData.get('year') as string) || 0;
        if (!categoryId || !rate) {
          return new Response(JSON.stringify({ success: false, message: 'Category and rate are required.' }), { status: 400 });
        }
        let effectiveSupplierId = supplierId;
        if (supplierId === 0 && newSupplierName) {
          const existing = await getSupplierByName(db, user.userId, newSupplierName);
          if (existing) {
            effectiveSupplierId = (existing as any).id;
          } else {
            const newId = await createSupplier(db, user.userId, newSupplierName);
            if (!newId) {
              return new Response(JSON.stringify({ success: false, message: 'Failed to create supplier.' }), { status: 500 });
            }
            effectiveSupplierId = newId as number;
          }
        }
        if (!effectiveSupplierId) {
          return new Response(JSON.stringify({ success: false, message: 'Please select or create a supplier.' }), { status: 400 });
        }
        if (accountId > 0) {
          await updateAccount(db, accountId, user.userId, {
            supplierId: effectiveSupplierId, categoryId, rate,
            autogenQuantity, autogenDaily, autogenTime,
            startDate, endDate, active,
          });
        } else {
          const exists = await checkAccountExists(db, user.userId, effectiveSupplierId, categoryId, autogenTime, year, month);
          if (exists) {
            return new Response(JSON.stringify({ success: false, message: 'This supplier+category+time combination already exists for this month.' }), { status: 409 });
          }
          const newAccountId = await createAccount(db, {
            userId: user.userId, supplierId: effectiveSupplierId,
            categoryId, rate, autogenQuantity, autogenDaily, autogenTime,
            year, month, startDate, endDate, active,
          });
          
          if (newAccountId && autogenQuantity > 0) {
            await bulkAutofill(db, newAccountId as number, autogenQuantity, autogenTime, startDate, endDate, year, month);
          }
        }
        return new Response(JSON.stringify({ success: true }));
      }
      case 'delete_account': {
        const accountId = parseInt(formData.get('account_id') as string) || 0;
        if (!accountId) return new Response(JSON.stringify({ success: false, message: 'Account ID required.' }), { status: 400 });
        await deleteAccount(db, accountId, user.userId);
        return new Response(JSON.stringify({ success: true }));
      }
      case 'delete_supplier': {
        const supplierId = parseInt(formData.get('supplier_id') as string) || 0;
        if (!supplierId) return new Response(JSON.stringify({ success: false, message: 'Supplier ID required.' }), { status: 400 });
        const deleted = await deleteSupplier(db, supplierId, user.userId);
        if (!deleted) return new Response(JSON.stringify({ success: false, message: 'Supplier not found or not yours.' }), { status: 404 });
        return new Response(JSON.stringify({ success: true }));
      }
      case 'update_entry': {
        const accountId = parseInt(formData.get('account_id') as string) || 0;
        const entryDate = formData.get('entry_date') as string;
        const quantityStr = formData.get('quantity') as string;
        const note = formData.get('note') as string || '';
        const quantity = quantityStr === '' || quantityStr === null ? 0 : parseFloat(quantityStr);
        if (!accountId || !entryDate) return new Response(JSON.stringify({ success: false, message: 'Account and date required.' }), { status: 400 });
        await upsertEntry(db, accountId, entryDate, quantity, 'manual', note);
        return new Response(JSON.stringify({ success: true }));
      }
      case 'bulk_autofill': {
        const accountId = parseInt(formData.get('account_id') as string) || 0;
        if (!accountId) return new Response(JSON.stringify({ success: false, message: 'Account ID required.' }), { status: 400 });
        const acc = await getAccountById(db, accountId, user.userId);
        if (!acc) return new Response(JSON.stringify({ success: false, message: 'Account not found.' }), { status: 404 });
        const qty = Number(acc.autogen_quantity) || 0;
        const autoTime = (acc.autogen_time as string) || '00:00:00';
        const startDate = (acc.start_date as string) || '';
        const endDate = (acc.end_date as string) || '';
        const yr = Number(acc.year);
        const mo = Number(acc.month);
        const filled = await bulkAutofill(db, accountId, qty, autoTime, startDate, endDate, yr, mo);
        return new Response(JSON.stringify({ success: true, filled }));
      }
      case 'add_payment': {
        const accountId = parseInt(formData.get('account_id') as string) || 0;
        const amount = parseFloat(formData.get('amount') as string) || 0;
        const paymentDate = (formData.get('payment_date') as string) || getLocalDateString();
        const note = (formData.get('note') as string) || '';
        if (!accountId || amount <= 0) return new Response(JSON.stringify({ success: false, message: 'Account and valid amount required.' }), { status: 400 });
        await createPayment(db, accountId, amount, paymentDate, note);
        return new Response(JSON.stringify({ success: true }));
      }
      case 'edit_payment': {
        const paymentId = parseInt(formData.get('payment_id') as string) || 0;
        const amount = parseFloat(formData.get('amount') as string) || 0;
        const paymentDate = (formData.get('payment_date') as string) || getLocalDateString();
        const note = (formData.get('note') as string) || '';
        if (!paymentId || amount <= 0) return new Response(JSON.stringify({ success: false, message: 'Payment ID and valid amount required.' }), { status: 400 });
        await updatePayment(db, paymentId, amount, paymentDate, note);
        return new Response(JSON.stringify({ success: true }));
      }
      case 'delete_payment': {
        const paymentId = parseInt(formData.get('payment_id') as string) || 0;
        if (!paymentId) return new Response(JSON.stringify({ success: false, message: 'Payment ID required.' }), { status: 400 });
        await deletePayment(db, paymentId);
        return new Response(JSON.stringify({ success: true }));
      }
      default:
        return new Response(JSON.stringify({ success: false, message: 'Unknown action: ' + action }), { status: 400 });
    }
  } catch (err: any) {
    console.error('API Error:', err);
    return new Response(JSON.stringify({ success: false, message: 'Server error: ' + err.message }), { status: 500 });
  }
};

export const GET: APIRoute = async (context) => {
  const { request, locals } = context;
  const user = (locals as any).user;
  if (!user) return new Response(JSON.stringify({ success: false, message: 'Unauthorized.' }), { status: 401 });
  const db = getDB(context);
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  try {
    if (action === 'get_last_config') {
      const supplierId = parseInt(url.searchParams.get('supplier_id') || '0');
      if (!supplierId) return new Response(JSON.stringify({ success: false, message: 'supplier_id required' }), { status: 400 });
      const config = await getLastConfig(db, supplierId, user.userId);
      return new Response(JSON.stringify({ success: true, config }));
    }
    return new Response(JSON.stringify({ success: false, message: 'Unknown GET action.' }), { status: 400 });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, message: 'Server error: ' + err.message }), { status: 500 });
  }
};
