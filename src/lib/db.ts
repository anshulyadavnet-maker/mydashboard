import type { D1Database } from '@cloudflare/workers-types';
import { getLocalDateString } from './milk';

export function getDB(context: any): D1Database {
  // The Astro context can have D1 binding at various paths depending on adapter version
  const db: D1Database | undefined =
    context?.locals?.runtime?.env?.DB ||
    context?.runtime?.env?.DB ||
    context?.locals?.runtime?.env?.milk?.['hissab-db'] ||
    context?.locals?.env?.DB ||
    context?.env?.DB ||
    context?.locals?.DB ||
    context?.DB ||
    context?.locals?.runtime?.cf?.DB ||
    context?.runtime?.cf?.DB;

  if (!db) {
    // Log what's available to debug
    const available = {
      'locals.runtime.env': Object.keys(context?.locals?.runtime?.env || {}),
      'runtime.env': Object.keys(context?.runtime?.env || {}),
      'locals.env': Object.keys(context?.locals?.env || {}),
      'env': Object.keys(context?.env || {}),
      'locals keys': Object.keys(context?.locals || {}),
      'context keys': Object.keys(context || {}),
    };
    throw new Error(
      'D1 Database binding not found. Available bindings: ' +
      JSON.stringify(available) +
      '\nMake sure you run with: npm run dev:build'
    );
  }
  return db;
}

export async function getUserByEmail(db: D1Database, email: string) {
  return await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
}

export async function createUser(db: D1Database, email: string, passwordHash: string, name?: string) {
  const result = await db.prepare(
    'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)'
  ).bind(email, passwordHash, name || '').run();
  return result.meta?.last_row_id;
}

export async function getSuppliers(db: D1Database, userId: number) {
  const result = await db.prepare(
    'SELECT * FROM milk_suppliers WHERE user_id = ? ORDER BY name ASC'
  ).bind(userId).all();
  return result.results;
}

export async function getSupplierByName(db: D1Database, userId: number, name: string) {
  return await db.prepare(
    'SELECT * FROM milk_suppliers WHERE user_id = ? AND name = ?'
  ).bind(userId, name).first();
}

export async function createSupplier(db: D1Database, userId: number, name: string) {
  const result = await db.prepare(
    'INSERT INTO milk_suppliers (user_id, name) VALUES (?, ?)'
  ).bind(userId, name).run();
  return result.meta?.last_row_id;
}

export async function deleteSupplier(db: D1Database, supplierId: number, userId: number) {
  await db.prepare(
    'DELETE FROM milk_payments WHERE account_id IN (SELECT id FROM milk_accounts WHERE milksupplier_id = ? AND user_id = ?)'
  ).bind(supplierId, userId).run();
  await db.prepare(
    'DELETE FROM milk_entries WHERE account_id IN (SELECT id FROM milk_accounts WHERE milksupplier_id = ? AND user_id = ?)'
  ).bind(supplierId, userId).run();
  await db.prepare(
    'DELETE FROM milk_accounts WHERE milksupplier_id = ? AND user_id = ?'
  ).bind(supplierId, userId).run();
  const result = await db.prepare(
    'DELETE FROM milk_suppliers WHERE id = ? AND user_id = ?'
  ).bind(supplierId, userId).run();
  return result.meta?.changes || 0;
}

export async function getCategories(db: D1Database, userId: number) {
  const result = await db.prepare(
    'SELECT * FROM milk_categories WHERE user_id IS NULL OR user_id = ? ORDER BY name ASC'
  ).bind(userId).all();
  return result.results;
}

export async function getAccounts(db: D1Database, userId: number, year: number, month: number) {
  const result = await db.prepare(`
    SELECT a.*, s.name as milksupplier_name, c.name as category_name
    FROM milk_accounts a
    JOIN milk_suppliers s ON a.milksupplier_id = s.id
    JOIN milk_categories c ON a.category_id = c.id
    WHERE a.user_id = ? AND a.year = ? AND a.month = ?
  `).bind(userId, year, month).all();
  return result.results;
}

export async function getAccountById(db: D1Database, accountId: number, userId: number) {
  return await db.prepare(
    'SELECT * FROM milk_accounts WHERE id = ? AND user_id = ?'
  ).bind(accountId, userId).first();
}

export async function getLastConfig(db: D1Database, supplierId: number, userId: number) {
  return await db.prepare(`
    SELECT rate, autogen_quantity, category_id
    FROM milk_accounts
    WHERE milksupplier_id = ? AND user_id = ?
    ORDER BY year DESC, month DESC LIMIT 1
  `).bind(supplierId, userId).first();
}

export async function createAccount(db: D1Database, data: any) {
  const result = await db.prepare(`
    INSERT INTO milk_accounts
      (user_id, milksupplier_id, category_id, rate, autogen_quantity, autogen_daily, autogen_time, year, month, start_date, end_date, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(data.userId, data.supplierId, data.categoryId, data.rate,
    data.autogenQuantity, data.autogenDaily, data.autogenTime,
    data.year, data.month, data.startDate, data.endDate, data.active).run();
  return result.meta?.last_row_id;
}

export async function updateAccount(db: D1Database, accountId: number, userId: number, data: any) {
  const result = await db.prepare(`
    UPDATE milk_accounts SET
      milksupplier_id = ?, category_id = ?, rate = ?,
      autogen_quantity = ?, autogen_daily = ?, autogen_time = ?,
      start_date = ?, end_date = ?, active = ?
    WHERE id = ? AND user_id = ?
  `).bind(data.supplierId, data.categoryId, data.rate,
    data.autogenQuantity, data.autogenDaily, data.autogenTime,
    data.startDate, data.endDate, data.active, accountId, userId).run();
  return result.meta?.changes || 0;
}

export async function deleteAccount(db: D1Database, accountId: number, userId: number) {
  await db.prepare('DELETE FROM milk_payments WHERE account_id = ?').bind(accountId).run();
  await db.prepare('DELETE FROM milk_entries WHERE account_id = ?').bind(accountId).run();
  const result = await db.prepare('DELETE FROM milk_accounts WHERE id = ? AND user_id = ?').bind(accountId, userId).run();
  return result.meta?.changes || 0;
}

export async function checkAccountExists(db: D1Database, userId: number, supplierId: number, categoryId: number, autogenTime: string, year: number, month: number) {
  return await db.prepare(
    'SELECT id FROM milk_accounts WHERE user_id = ? AND milksupplier_id = ? AND category_id = ? AND autogen_time = ? AND year = ? AND month = ?'
  ).bind(userId, supplierId, categoryId, autogenTime, year, month).first();
}

export async function getEntriesForAccount(db: D1Database, accountId: number, year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
  const result = await db.prepare(
    'SELECT entry_date, quantity, entry_type FROM milk_entries WHERE account_id = ? AND entry_date >= ? AND entry_date <= ?'
  ).bind(accountId, startDate, endDate).all();
  return result.results;
}

export async function upsertEntry(db: D1Database, accountId: number, entryDate: string, quantity: number, entryType: string) {
  await db.prepare(`
    INSERT INTO milk_entries (account_id, entry_date, quantity, entry_type)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(account_id, entry_date) DO UPDATE SET quantity = ?, entry_type = ?
  `).bind(accountId, entryDate, quantity, entryType, quantity, entryType).run();
}

export async function bulkAutofill(db: D1Database, accountId: number, quantity: number, autogenTime: string, startDate: string, endDate: string, year: number, month: number) {
  const today = getLocalDateString();
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
  const effectiveEnd = [today, endDate, monthEnd].sort()[0];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(effectiveEnd + 'T00:00:00');
  const existing = await db.prepare(
    'SELECT entry_date FROM milk_entries WHERE account_id = ? AND entry_date >= ? AND entry_date <= ?'
  ).bind(accountId, startDate, effectiveEnd).all();
  const existingDates = new Set((existing.results as any[]).map(r => r.entry_date));
  const now = new Date();
  const [autoHour, autoMin] = autogenTime.split(':').map(Number);
  const stmts: any[] = [];
  const current = new Date(start);
  while (current <= end) {
    const dateStr = getLocalDateString(current);
    if (existingDates.has(dateStr)) { current.setDate(current.getDate() + 1); continue; }
    if (dateStr === today) {
      const targetTime = new Date(today + `T${String(autoHour).padStart(2, '0')}:${String(autoMin).padStart(2, '0')}:00`);
      if (now < targetTime) { current.setDate(current.getDate() + 1); continue; }
    }
    stmts.push(db.prepare(
      'INSERT INTO milk_entries (account_id, entry_date, quantity, entry_type) VALUES (?, ?, ?, ?) ON CONFLICT(account_id, entry_date) DO NOTHING'
    ).bind(accountId, dateStr, quantity, 'auto'));
    current.setDate(current.getDate() + 1);
  }
  for (let i = 0; i < stmts.length; i += 10) {
    const batch = stmts.slice(i, i + 10);
    await db.batch(batch);
  }
  return stmts.length;
}

export async function getPaymentsForAccount(db: D1Database, accountId: number) {
  const result = await db.prepare('SELECT SUM(amount) as total FROM milk_payments WHERE account_id = ?').bind(accountId).first();
  return (result as any)?.total || 0;
}

export async function getPaymentHistory(db: D1Database, userId: number, year: number, month: number) {
  const result = await db.prepare(`
    SELECT p.*, s.name as milksupplier_name, c.name as category_name
    FROM milk_payments p
    JOIN milk_accounts a ON p.account_id = a.id
    JOIN milk_suppliers s ON a.milksupplier_id = s.id
    JOIN milk_categories c ON a.category_id = c.id
    WHERE a.user_id = ? AND a.year = ? AND a.month = ?
    ORDER BY p.payment_date DESC, p.id DESC
  `).bind(userId, year, month).all();
  return result.results;
}

export async function createPayment(db: D1Database, accountId: number, amount: number, paymentDate: string, note: string) {
  const result = await db.prepare(
    'INSERT INTO milk_payments (account_id, amount, payment_date, note) VALUES (?, ?, ?, ?)'
  ).bind(accountId, amount, paymentDate, note || '').run();
  return result.meta?.last_row_id;
}

export async function updatePayment(db: D1Database, paymentId: number, amount: number, paymentDate: string, note: string) {
  const result = await db.prepare(
    'UPDATE milk_payments SET amount = ?, payment_date = ?, note = ? WHERE id = ?'
  ).bind(amount, paymentDate, note || '', paymentId).run();
  return result.meta?.changes || 0;
}

export async function deletePayment(db: D1Database, paymentId: number) {
  const result = await db.prepare('DELETE FROM milk_payments WHERE id = ?').bind(paymentId).run();
  return result.meta?.changes || 0;
}

// Notes CRUD
export async function getNotes(db: D1Database, userId: number) {
  const result = await db.prepare(`
    SELECT n.*, group_concat(t.tag) as tags
    FROM notes n
    LEFT JOIN note_tags t ON n.id = t.note_id
    WHERE n.user_id = ?
    GROUP BY n.id
    ORDER BY n.updated_at DESC
  `).bind(userId).all();
  return result.results;
}

export async function createNote(db: D1Database, userId: number, content: string, color: string, tags: string[]) {
  const result = await db.prepare(
    'INSERT INTO notes (user_id, content, color) VALUES (?, ?, ?)'
  ).bind(userId, content, color).run();
  const noteId = result.meta?.last_row_id;
  if (noteId && tags.length > 0) {
    const stmts = tags.map(tag => 
      db.prepare('INSERT INTO note_tags (note_id, tag) VALUES (?, ?)').bind(noteId, tag.trim())
    );
    await db.batch(stmts);
  }
  return noteId;
}

export async function updateNote(db: D1Database, noteId: number, userId: number, content: string, color: string, tags: string[]) {
  await db.prepare(
    'UPDATE notes SET content = ?, color = ?, updated_at = datetime(\'now\') WHERE id = ? AND user_id = ?'
  ).bind(content, color, noteId, userId).run();
  
  await db.prepare('DELETE FROM note_tags WHERE note_id = ?').bind(noteId).run();
  if (tags.length > 0) {
    const stmts = tags.map(tag => 
      db.prepare('INSERT INTO note_tags (note_id, tag) VALUES (?, ?)').bind(noteId, tag.trim())
    );
    await db.batch(stmts);
  }
}

export async function deleteNote(db: D1Database, noteId: number, userId: number) {
  await db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').bind(noteId, userId).run();
}

// Expenses CRUD
export async function getExpenses(db: D1Database, userId: number, year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
  const result = await db.prepare(`
    SELECT * FROM expenses 
    WHERE user_id = ? AND expense_date >= ? AND expense_date <= ?
    ORDER BY expense_date DESC, created_at DESC
  `).bind(userId, startDate, endDate).all();
  return result.results;
}

export async function createExpense(db: D1Database, userId: number, amount: number, category: string, note: string, date: string, color: string) {
  const result = await db.prepare(
    'INSERT INTO expenses (user_id, amount, category, note, expense_date, color) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(userId, amount, category, note, date, color).run();
  return result.meta?.last_row_id;
}

export async function updateExpense(db: D1Database, expenseId: number, userId: number, amount: number, category: string, note: string, date: string, color: string) {
  await db.prepare(`
    UPDATE expenses SET amount = ?, category = ?, note = ?, expense_date = ?, color = ?
    WHERE id = ? AND user_id = ?
  `).bind(amount, category, note, date, color, expenseId, userId).run();
}

export async function deleteExpense(db: D1Database, expenseId: number, userId: number) {
  await db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?').bind(expenseId, userId).run();
}

// Passwords CRUD
export async function getPasswords(db: D1Database, userId: number) {
  const result = await db.prepare(`
    SELECT * FROM passwords 
    WHERE user_id = ? 
    ORDER BY service_name ASC
  `).bind(userId).all();
  return result.results;
}

export async function createPassword(db: D1Database, userId: number, data: any) {
  const result = await db.prepare(`
    INSERT INTO passwords (user_id, service_name, service_id, email, password, category, color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(userId, data.service_name, data.service_id, data.email, data.password, data.category, data.color || '#ffffff').run();
  return result.meta?.last_row_id;
}

export async function updatePassword(db: D1Database, passwordId: number, userId: number, data: any) {
  await db.prepare(`
    UPDATE passwords SET 
      service_name = ?, service_id = ?, email = ?, password = ?, category = ?, color = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).bind(data.service_name, data.service_id, data.email, data.password, data.category, data.color || '#ffffff', passwordId, userId).run();
}

export async function deletePassword(db: D1Database, passwordId: number, userId: number) {
  await db.prepare('DELETE FROM passwords WHERE id = ? AND user_id = ?').bind(passwordId, userId).run();
}

// Tool Usage Tracking Helpers
export async function recordToolUsage(db: D1Database, userId: number, toolId: string) {
  await db.prepare(`
    INSERT INTO tool_usage (user_id, tool_id, use_count, last_used_at)
    VALUES (?, ?, 1, datetime('now'))
    ON CONFLICT(user_id, tool_id) DO UPDATE SET
      use_count = use_count + 1,
      last_used_at = datetime('now')
  `).bind(userId, toolId).run();
}

export async function getToolUsage(db: D1Database, userId: number) {
  const result = await db.prepare(
    'SELECT tool_id, use_count, last_used_at FROM tool_usage WHERE user_id = ?'
  ).bind(userId).all();
  return result.results;
}

