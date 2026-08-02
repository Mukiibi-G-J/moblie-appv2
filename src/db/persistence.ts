import {open, type DB} from '@op-engineering/op-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

let dbInstance: DB | null = null;
let currentDbKey: string | null = null;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS items (
  system_id TEXT PRIMARY KEY,
  no TEXT,
  item_name TEXT,
  payload TEXT
);
CREATE TABLE IF NOT EXISTS categories (
  code TEXT PRIMARY KEY,
  description TEXT,
  level INTEGER,
  parent_id TEXT,
  payload TEXT
);
CREATE TABLE IF NOT EXISTS units (
  code TEXT PRIMARY KEY,
  description TEXT,
  payload TEXT
);
CREATE TABLE IF NOT EXISTS tracking_codes (
  code TEXT PRIMARY KEY,
  description TEXT,
  payload TEXT
);
CREATE TABLE IF NOT EXISTS item_uoms (
  id INTEGER PRIMARY KEY,
  item TEXT,
  unit_of_measure TEXT,
  quantity_per_unit REAL,
  payload TEXT
);
CREATE TABLE IF NOT EXISTS attribute_entries (
  id INTEGER PRIMARY KEY,
  item TEXT,
  payload TEXT
);
CREATE TABLE IF NOT EXISTS item_images (
  id TEXT PRIMARY KEY,
  item TEXT,
  payload TEXT
);
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT,
  payload TEXT
);
CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  name TEXT,
  payload TEXT
);
CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT,
  no TEXT,
  payload TEXT
);
CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY,
  code TEXT,
  description TEXT,
  payload TEXT
);
CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS sync_cursors (
  resource TEXT NOT NULL,
  branch_id TEXT,
  updated_since TEXT,
  last_synced_at TEXT,
  PRIMARY KEY (resource, branch_id)
);
CREATE TABLE IF NOT EXISTS item_on_hand (
  item_system_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  quantity REAL,
  item_no TEXT,
  updated_at TEXT,
  PRIMARY KEY (item_system_id, branch_id)
);
CREATE TABLE IF NOT EXISTS outbox (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  client_created_at TEXT
);
CREATE TABLE IF NOT EXISTS local_sales (
  local_id TEXT PRIMARY KEY,
  system_id TEXT,
  receipt_no TEXT,
  sync_status TEXT,
  customer_name TEXT,
  total_amount REAL,
  payload TEXT,
  created_at TEXT,
  server_sale_id INTEGER,
  server_invoice_no TEXT,
  branch_id INTEGER,
  branch_name TEXT
);
CREATE TABLE IF NOT EXISTS local_sale_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_local_id TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sales_setup_cache (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT
);
CREATE TABLE IF NOT EXISTS company_info_cache (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT
);
`;

async function ensureSchema(db: DB) {
  for (const statement of SCHEMA_SQL.split(';')) {
    const sql = statement.trim();
    if (sql) {
      await db.execute(sql);
    }
  }
  await migrateLocalSalesSchema(db);
}

async function migrateLocalSalesSchema(db: DB) {
  const info = await db.execute('PRAGMA table_info(local_sales)');
  const columns = new Set(
    (info.rows || []).map((r: Record<string, unknown>) => String(r.name)),
  );
  if (!columns.has('branch_id')) {
    await db.execute('ALTER TABLE local_sales ADD COLUMN branch_id INTEGER');
  }
  if (!columns.has('branch_name')) {
    await db.execute('ALTER TABLE local_sales ADD COLUMN branch_name TEXT');
  }
}

async function resolveDbKey(): Promise<string> {
  const tenant = (await AsyncStorage.getItem('tenant'))?.trim().toLowerCase();
  const schema = tenant || 'default';
  return `${schema.replace(/[^a-z0-9_]/gi, '_')}_pos_v1`;
}

export async function openPosDatabase(): Promise<DB> {
  const key = await resolveDbKey();
  if (dbInstance && currentDbKey === key) {
    return dbInstance;
  }
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      /* ignore */
    }
    dbInstance = null;
    currentDbKey = null;
  }
  dbInstance = open({name: key});
  currentDbKey = key;
  await ensureSchema(dbInstance);
  return dbInstance;
}

export async function closePosDatabase(): Promise<void> {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      /* ignore */
    }
    dbInstance = null;
    currentDbKey = null;
  }
}

export async function getDb(): Promise<DB> {
  return openPosDatabase();
}
