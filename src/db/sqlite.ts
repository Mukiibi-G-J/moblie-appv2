import type {DB} from '@op-engineering/op-sqlite';
import {getDb} from './persistence';
import {randomUUID} from '../utils/randomUuid';
import type {CartItem} from '../@types/types.dto';
import type {Customer, PaymentMethod} from '../services/app.services';

export type LocalItem = CartItem & {
  system_id?: string;
  item_name?: string;
  bar_code_no?: string;
  inventory?: number;
};

export type OutboxRow = {
  event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: string;
  retry_count: number;
  last_error?: string;
  created_at: string;
};

export type BranchRow = {
  id: number;
  code: string;
  description: string;
};

const parseRows = <T>(rows: Record<string, unknown>[]): T[] =>
  rows
    .map(row => {
      try {
        return JSON.parse(String(row.payload ?? '')) as T;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as T[];

async function withTransaction(db: DB, fn: () => Promise<void>) {
  await db.execute('BEGIN');
  try {
    await fn();
    await db.execute('COMMIT');
  } catch (e) {
    await db.execute('ROLLBACK');
    throw e;
  }
}

export async function saveCategories(categories: unknown[]) {
  const db = await getDb();
  await withTransaction(db, async () => {
    for (const category of categories as Record<string, unknown>[]) {
      await db.execute(
        `INSERT OR REPLACE INTO categories (code, description, level, parent_id, payload)
         VALUES (?, ?, ?, ?, ?)`,
        [
          String(category.code ?? ''),
          String(category.description ?? ''),
          category.level != null ? Number(category.level) : null,
          category.parent_id != null ? String(category.parent_id) : null,
          JSON.stringify(category),
        ],
      );
    }
  });
}

export async function saveUnits(units: unknown[]) {
  const db = await getDb();
  await withTransaction(db, async () => {
    for (const unit of units as Record<string, unknown>[]) {
      await db.execute(
        `INSERT OR REPLACE INTO units (code, description, payload) VALUES (?, ?, ?)`,
        [
          String(unit.code ?? ''),
          String(unit.description ?? ''),
          JSON.stringify(unit),
        ],
      );
    }
  });
}

export async function saveTrackingCodes(codes: unknown[]) {
  const db = await getDb();
  await withTransaction(db, async () => {
    for (const code of codes as Record<string, unknown>[]) {
      await db.execute(
        `INSERT OR REPLACE INTO tracking_codes (code, description, payload) VALUES (?, ?, ?)`,
        [
          String(code.code ?? ''),
          String(code.description ?? ''),
          JSON.stringify(code),
        ],
      );
    }
  });
}

export async function saveItemsBatch(items: LocalItem[]) {
  if (!items.length) return;
  const db = await getDb();
  await withTransaction(db, async () => {
    for (const item of items) {
      const id = item.system_id || item.no;
      if (!id) continue;
      await db.execute(
        `INSERT OR REPLACE INTO items (system_id, no, item_name, payload) VALUES (?, ?, ?, ?)`,
        [
          String(id),
          String(item.no ?? ''),
          String(item.item_name ?? item.name ?? ''),
          JSON.stringify(item),
        ],
      );
    }
  });
}

export async function saveCustomers(customers: Customer[]) {
  const db = await getDb();
  await withTransaction(db, async () => {
    for (const customer of customers) {
      const c = customer as Record<string, unknown>;
      const id =
        String(c.no ?? '') ||
        String(c.id ?? '') ||
        String(c.system_id ?? '') ||
        String(c.email ?? '');
      if (!id) continue;
      await db.execute(
        `INSERT OR REPLACE INTO customers (id, name, phone, payload) VALUES (?, ?, ?, ?)`,
        [
          id,
          String(c.name ?? c.full_name ?? ''),
          String(c.phone ?? c.phone_number ?? ''),
          JSON.stringify(customer),
        ],
      );
    }
  });
}

export async function savePaymentMethods(methods: PaymentMethod[]) {
  const db = await getDb();
  await withTransaction(db, async () => {
    for (const m of methods) {
      const rec = m as Record<string, unknown>;
      const id = String(rec.id ?? rec.code ?? rec.description ?? '');
      if (!id) continue;
      await db.execute(
        `INSERT OR REPLACE INTO payment_methods (id, name, payload) VALUES (?, ?, ?)`,
        [
          id,
          String(rec.description ?? rec.name ?? rec.code ?? ''),
          JSON.stringify(m),
        ],
      );
    }
  });
}

export async function saveBranches(branches: BranchRow[]) {
  const db = await getDb();
  await withTransaction(db, async () => {
    for (const branch of branches) {
      await db.execute(
        `INSERT OR REPLACE INTO branches (id, code, description, payload) VALUES (?, ?, ?, ?)`,
        [
          branch.id,
          branch.code,
          branch.description ?? '',
          JSON.stringify(branch),
        ],
      );
    }
  });
}

export async function getItemCount(): Promise<number> {
  const db = await getDb();
  const res = await db.execute('SELECT COUNT(*) as count FROM items');
  return Number(res.rows?.[0]?.count ?? 0);
}

export async function getAllItems(): Promise<LocalItem[]> {
  const db = await getDb();
  const res = await db.execute('SELECT payload FROM items');
  return parseRows<LocalItem>(res.rows ?? []);
}

export async function getItemById(id: string): Promise<LocalItem | null> {
  const db = await getDb();
  const res = await db.execute(
    'SELECT payload FROM items WHERE system_id = ? OR no = ? LIMIT 1',
    [id, id],
  );
  const payload = res.rows?.[0]?.payload;
  if (!payload) return null;
  try {
    return JSON.parse(String(payload)) as LocalItem;
  } catch {
    return null;
  }
}

export async function getCustomerCount(): Promise<number> {
  const db = await getDb();
  const res = await db.execute('SELECT COUNT(*) as count FROM customers');
  return Number(res.rows?.[0]?.count ?? 0);
}

export async function getAllCustomers(): Promise<Customer[]> {
  const db = await getDb();
  const res = await db.execute('SELECT id, name, phone, payload FROM customers');
  const customers: Customer[] = [];
  for (const row of res.rows ?? []) {
    try {
      if (row.payload) {
        customers.push(JSON.parse(String(row.payload)) as Customer);
        continue;
      }
    } catch {
      /* fall through */
    }
    customers.push({
      id: Number(row.id) || 0,
      name: String(row.name ?? ''),
      phone_number: String(row.phone ?? ''),
    } as Customer);
  }
  return customers;
}

export async function getPaymentMethodCount(): Promise<number> {
  const db = await getDb();
  const res = await db.execute('SELECT COUNT(*) as count FROM payment_methods');
  return Number(res.rows?.[0]?.count ?? 0);
}

export async function getAllPaymentMethods(): Promise<PaymentMethod[]> {
  const db = await getDb();
  const res = await db.execute('SELECT payload FROM payment_methods');
  return parseRows<PaymentMethod>(res.rows ?? []);
}

export async function getBranchCount(): Promise<number> {
  const db = await getDb();
  const res = await db.execute('SELECT COUNT(*) as count FROM branches');
  return Number(res.rows?.[0]?.count ?? 0);
}

export async function getAllBranches(): Promise<BranchRow[]> {
  const db = await getDb();
  const res = await db.execute(
    'SELECT id, code, description, payload FROM branches ORDER BY code',
  );
  return (res.rows ?? []).map(row => {
    if (row.payload) {
      try {
        return JSON.parse(String(row.payload)) as BranchRow;
      } catch {
        /* fall through */
      }
    }
    return {
      id: Number(row.id),
      code: String(row.code ?? ''),
      description: String(row.description ?? ''),
    };
  });
}

export async function getSyncMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const res = await db.execute('SELECT value FROM sync_meta WHERE key = ?', [
    key,
  ]);
  const value = res.rows?.[0]?.value;
  return value != null ? String(value) : null;
}

export async function setSyncMeta(key: string, value: string) {
  const db = await getDb();
  await db.execute('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)', [
    key,
    value,
  ]);
}

export async function getOrCreateDeviceId(): Promise<string> {
  let id = await getSyncMeta('device_id');
  if (!id) {
    id = randomUUID();
    await setSyncMeta('device_id', id);
  }
  return id;
}

export async function saveItemOnHand(
  rows: {
    item_system_id: string;
    branch_id: string | number | null;
    quantity: number;
    item_no?: string;
  }[],
) {
  const db = await getDb();
  const now = new Date().toISOString();
  await withTransaction(db, async () => {
    for (const row of rows) {
      await db.execute(
        `INSERT OR REPLACE INTO item_on_hand (item_system_id, branch_id, quantity, item_no, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          row.item_system_id,
          row.branch_id != null ? String(row.branch_id) : '',
          row.quantity,
          row.item_no ?? '',
          now,
        ],
      );
    }
  });
}

export async function getItemOnHand(
  itemSystemId: string,
  branchId: string | number | null,
): Promise<number> {
  const db = await getDb();
  const res = await db.execute(
    `SELECT quantity FROM item_on_hand WHERE item_system_id = ? AND branch_id = ?`,
    [itemSystemId, branchId != null ? String(branchId) : ''],
  );
  return Number(res.rows?.[0]?.quantity ?? 0);
}

export async function enqueueOutbox(
  eventId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT OR REPLACE INTO outbox (event_id, event_type, payload, status, retry_count, last_error, created_at, client_created_at)
     VALUES (?, ?, ?, 'pending', 0, '', ?, ?)`,
    [eventId, eventType, JSON.stringify(payload), now, now],
  );
}

export async function listPendingOutbox(): Promise<OutboxRow[]> {
  const db = await getDb();
  const res = await db.execute(
    `SELECT event_id, event_type, payload, status, retry_count, last_error, created_at
     FROM outbox WHERE status IN ('pending', 'failed') ORDER BY created_at ASC`,
  );
  return (res.rows ?? []).map(r => ({
    event_id: String(r.event_id),
    event_type: String(r.event_type),
    payload: JSON.parse(String(r.payload || '{}')) as Record<string, unknown>,
    status: String(r.status),
    retry_count: Number(r.retry_count || 0),
    last_error: r.last_error ? String(r.last_error) : undefined,
    created_at: String(r.created_at),
  }));
}

export async function updateOutboxStatus(
  eventId: string,
  status: string,
  lastError?: string,
) {
  const db = await getDb();
  if (lastError !== undefined) {
    await db.execute(
      `UPDATE outbox SET status = ?, last_error = ?, retry_count = retry_count + 1 WHERE event_id = ?`,
      [status, lastError, eventId],
    );
  } else {
    await db.execute(
      `UPDATE outbox SET status = ?, last_error = '' WHERE event_id = ?`,
      [status, eventId],
    );
  }
}

export async function countPendingOutbox(): Promise<number> {
  const db = await getDb();
  const res = await db.execute(
    `SELECT COUNT(*) as count FROM outbox WHERE status IN ('pending', 'failed')`,
  );
  return Number(res.rows?.[0]?.count ?? 0);
}

export async function saveLocalSale(record: {
  local_id: string;
  system_id: string;
  receipt_no: string;
  customer_name: string;
  total_amount: number;
  payload: Record<string, unknown>;
  lines: Record<string, unknown>[];
  branch_id?: number | null;
  branch_name?: string | null;
}) {
  const db = await getDb();
  const now = new Date().toISOString();
  await withTransaction(db, async () => {
    await db.execute(
      `INSERT OR REPLACE INTO local_sales (local_id, system_id, receipt_no, sync_status, customer_name, total_amount, payload, created_at, branch_id, branch_name)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
      [
        record.local_id,
        record.system_id,
        record.receipt_no,
        record.customer_name,
        record.total_amount,
        JSON.stringify(record.payload),
        now,
        record.branch_id ?? null,
        record.branch_name ?? null,
      ],
    );
    await db.execute(`DELETE FROM local_sale_lines WHERE sale_local_id = ?`, [
      record.local_id,
    ]);
    for (const line of record.lines) {
      await db.execute(
        `INSERT INTO local_sale_lines (sale_local_id, payload) VALUES (?, ?)`,
        [record.local_id, JSON.stringify(line)],
      );
    }
  });
}

export async function updateLocalSaleSynced(
  localId: string,
  server: {server_sale_id?: number; invoice_no?: string},
) {
  const db = await getDb();
  await db.execute(
    `UPDATE local_sales SET sync_status = 'synced', server_sale_id = ?, server_invoice_no = ? WHERE local_id = ?`,
    [server.server_sale_id ?? null, server.invoice_no ?? null, localId],
  );
}

export async function listLocalSales(status?: string) {
  const db = await getDb();
  const res = status
    ? await db.execute(
        `SELECT * FROM local_sales WHERE sync_status = ? ORDER BY created_at DESC`,
        [status],
      )
    : await db.execute(`SELECT * FROM local_sales ORDER BY created_at DESC`);
  return res.rows ?? [];
}

export type LocalSaleDetail = {
  local_id: string;
  system_id: string;
  receipt_no: string;
  sync_status: string;
  customer_name: string;
  total_amount: number;
  created_at: string;
  branch_id?: number | null;
  branch_name?: string | null;
  payload: Record<string, unknown>;
  lines: Record<string, unknown>[];
};

export async function getLocalSaleWithLines(
  localId: string,
): Promise<LocalSaleDetail | null> {
  const db = await getDb();
  const saleRes = await db.execute(
    `SELECT * FROM local_sales WHERE local_id = ?`,
    [localId],
  );
  const sale = saleRes.rows?.[0];
  if (!sale) return null;

  const linesRes = await db.execute(
    `SELECT payload FROM local_sale_lines WHERE sale_local_id = ? ORDER BY rowid`,
    [localId],
  );
  const lines = (linesRes.rows ?? []).map(row => {
    try {
      return JSON.parse(String(row.payload || '{}')) as Record<string, unknown>;
    } catch {
      return {};
    }
  });

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(String(sale.payload || '{}')) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  return {
    local_id: String(sale.local_id),
    system_id: String(sale.system_id ?? ''),
    receipt_no: String(sale.receipt_no ?? ''),
    sync_status: String(sale.sync_status ?? 'pending'),
    customer_name: String(sale.customer_name ?? ''),
    total_amount: Number(sale.total_amount ?? 0),
    created_at: String(sale.created_at ?? ''),
    branch_id: sale.branch_id != null ? Number(sale.branch_id) : null,
    branch_name: sale.branch_name ? String(sale.branch_name) : null,
    payload,
    lines,
  };
}

export async function getCachedCompanyInfo(): Promise<Record<string, unknown> | null> {
  const db = await getDb();
  const res = await db.execute(
    'SELECT payload FROM company_info_cache WHERE id = 1',
  );
  const payload = res.rows?.[0]?.payload;
  if (!payload) return null;
  try {
    return JSON.parse(String(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function saveBootstrapCache(data: {
  sales_setup?: unknown;
  company_info?: unknown;
}) {
  const db = await getDb();
  if (data.sales_setup !== undefined) {
    await db.execute(
      `INSERT OR REPLACE INTO sales_setup_cache (id, payload) VALUES (1, ?)`,
      [JSON.stringify(data.sales_setup)],
    );
  }
  if (data.company_info !== undefined) {
    await db.execute(
      `INSERT OR REPLACE INTO company_info_cache (id, payload) VALUES (1, ?)`,
      [JSON.stringify(data.company_info)],
    );
  }
}

export async function applyBootstrapItems(
  items: LocalItem[],
  itemOnHand: {
    item_system_id: string;
    branch_id?: number | null;
    quantity: number;
    item_no?: string;
  }[],
) {
  if (items.length) {
    await saveItemsBatch(items);
  }
  if (itemOnHand.length) {
    await saveItemOnHand(
      itemOnHand.map(r => ({
        item_system_id: r.item_system_id,
        branch_id: r.branch_id ?? null,
        quantity: Number(r.quantity || 0),
        item_no: r.item_no,
      })),
    );
  }
}

export {getDb, openPosDatabase, closePosDatabase} from './persistence';
