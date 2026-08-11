import type {Customer} from '../@types/customer';
import type {Expense} from '../@types/expense';
import type {Vendor} from '../@types/vendor';
import type {BankAccount, BankAccountLedgerEntry} from '../@types/bankAccount';
import type {PaymentJournal} from '../@types/paymentJournal';
import type {User, UserGroup} from '../@types/userManagement';
import type {PageDataRecord} from './pageDataService';

function asString(value: unknown, fallback = ''): string {
  if (value == null) {
    return fallback;
  }
  return String(value);
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asOptionalNumber(value: unknown): number | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function systemIdOf(row: PageDataRecord): string {
  return asString(row.SystemId ?? row.system_id ?? row.id ?? row.no);
}

function mapTrackingCode(raw: unknown) {
  if (!raw) {
    return null;
  }
  let value: any = raw;
  if (Array.isArray(value)) {
    value = value.length > 0 ? value[0] : null;
  }
  if (!value || typeof value !== 'object') {
    return null;
  }
  return {
    system_id: value.system_id != null ? String(value.system_id) : undefined,
    code: value.code != null ? String(value.code) : undefined,
    description:
      value.description != null ? String(value.description) : undefined,
    require_serial_no: Boolean(value.require_serial_no),
    require_lot_no: Boolean(value.require_lot_no),
    require_expiry_date: Boolean(value.require_expiry_date),
  };
}

export function mapPageDataItem(row: PageDataRecord) {
  return {
    id: asOptionalNumber(row.id),
    no: asString(row.no),
    system_id: systemIdOf(row),
    item_name: asString(row.item_name),
    unit_price: asNumber(row.unit_price),
    item_images: Array.isArray(row.item_images)
      ? (row.item_images as {url: string; id: number}[])
      : [],
    inventory: asNumber(row.inventory),
    minimum_stock: asOptionalNumber(row.minimum_stock) ?? null,
    type: asString(row.type) || undefined,
    category_id: (row.category_id as number | string | null | undefined) ?? null,
    item_category: row.item_category,
    description: asString(row.description) || undefined,
    bar_code_no: asString(row.bar_code_no) || undefined,
    unit_cost: asOptionalNumber(row.unit_cost),
    unit_of_measure: asString(row.unit_of_measure) || undefined,
    // Present when page-data includes nested tracking; otherwise Make Sale
    // enriches via GET /api/items/?no= (same as web POS).
    tracking_code: mapTrackingCode(
      row.tracking_code ?? row.trackingCode ?? null,
    ),
  };
}

export function mapPageDataCustomer(row: PageDataRecord): Customer {
  return {
    id: asNumber(row.id),
    system_id: systemIdOf(row),
    no: asString(row.no),
    name: asString(row.name),
    phone_number: asString(row.phone_number) || undefined,
    address: asString(row.address) || undefined,
    balance: row.balance != null ? asString(row.balance) : undefined,
    contact: asString(row.contact) || undefined,
    city: asString(row.city) || undefined,
    payment_method:
      row.payment_method != null && row.payment_method !== ''
        ? asNumber(row.payment_method)
        : undefined,
    customer_type:
      (asString(row.customer_type) as Customer['customer_type']) || undefined,
  };
}

export function mapPageDataVendor(row: PageDataRecord): Vendor {
  return {
    id: asNumber(row.id),
    system_id: systemIdOf(row),
    no: asString(row.no),
    name: asString(row.name),
    phone: asString(row.phone) || undefined,
    email: asString(row.email) || undefined,
    balance: row.balance != null ? asString(row.balance) : undefined,
    blocked: Boolean(row.blocked),
    payment_method:
      row.payment_method != null && row.payment_method !== ''
        ? asNumber(row.payment_method)
        : undefined,
  };
}

export function mapPageDataExpense(row: PageDataRecord): Expense {
  const expenseTypeRaw = row.expense_type;
  const expenseTypeName =
    asString(row['expense_type__name'] ?? row.expense_type_name) || undefined;

  return {
    id: asNumber(row.id),
    document_no: asString(row.document_no),
    posting_date: asString(row.posting_date),
    description: asString(row.description) || undefined,
    expense_type: asNumber(expenseTypeRaw),
    expense_type_name: expenseTypeName,
    amount: asNumber(row.amount),
    status: (asString(row.status, 'Open') as Expense['status']) || 'Open',
    payment_method: asOptionalNumber(row.payment_method),
    payment_method_name: asString(row.payment_method_name ?? row.payment_method) || undefined,
  };
}

/** Map PostedSalesInvoice page-data row → Sales History list shape. */
export function mapPageDataSale(row: PageDataRecord): Record<string, unknown> {
  const closed = Boolean(row.closed);
  const reversed = Boolean(row.reversed);
  // `id` is PostedSalesInvoice.pk (not SalesInvoice.pk). Detail/print resolve
  // via invoice_no → live SalesInvoice, or backend PostedSalesInvoice lookup.
  return {
    id: asOptionalNumber(row.id) ?? row.id,
    posted_id: asOptionalNumber(row.id) ?? row.id,
    system_id: systemIdOf(row),
    invoice_no: asString(row.no ?? row.invoice_no),
    customer_name: asString(row.customer ?? row.customer_name),
    document_date: asString(
      row.document_date || row.posting_date || row.created_at,
    ),
    posting_date: asString(row.posting_date) || undefined,
    total_amount: asNumber(row.total_amount),
    payment_method_name: asString(row.payment_method_name) || undefined,
    payment_status: closed ? 'Paid' : 'Not Paid Yet',
    status: asString(row.status, 'Posted') || 'Posted',
    reversed,
    closed,
    user_name: asString(row.user_name) || undefined,
    created_at: asString(row.created_at) || undefined,
  };
}

export function mapPageDataOpenSale(row: PageDataRecord): Record<string, unknown> {
  return {
    id: asOptionalNumber(row.id) ?? row.id,
    system_id: systemIdOf(row),
    invoice_no: asString(row.invoice_no ?? row.no),
    customer_name: asString(row.customer ?? row.customer_name),
    document_date: asString(row.document_date || row.posting_date),
    total_amount: asNumber(row.total_amount ?? row.amount),
    status: asString(row.status, 'Open') || 'Open',
    reversed: Boolean(row.reversed),
  };
}

export function mapPageDataPurchase(row: PageDataRecord): Record<string, unknown> {
  return {
    id: asOptionalNumber(row.id) ?? row.id,
    system_id: systemIdOf(row),
    invoice_no: asString(row.invoice_no ?? row.no),
    no: asString(row.no ?? row.invoice_no),
    vendor: row.vendor,
    vendor_name: asString(row.vendor_name ?? row.vendor),
    document_date: asString(row.document_date || row.posting_date),
    posting_date: asString(row.posting_date) || undefined,
    status: asString(row.status, 'Open') || 'Open',
    total_amount: asNumber(row.total_amount ?? row.amount),
    vendor_invoice_no: asString(row.vendor_invoice_no) || undefined,
  };
}

export function mapPageDataPaymentJournal(row: PageDataRecord): PaymentJournal {
  return {
    id: asNumber(row.id),
    system_id: systemIdOf(row),
    posting_date: asString(row.posting_date),
    document_type: asString(row.document_type),
    document_no: asString(row.document_no),
    account_type: (asString(row.account_type) || null) as string | null,
    account_content_type_id: asNumber(row.account_content_type_id),
    account_object_id: asNumber(row.account_object_id),
    account_name: asString(row.account_name) || undefined,
    description: asString(row.description) || undefined,
    payment_method: asOptionalNumber(row.payment_method),
    payment_method_name: asString(row.payment_method_name) || undefined,
    amount: asNumber(row.amount),
    bal_account_type: (asString(row.bal_account_type) || null) as string | null,
    bal_account_content_type_id: asNumber(row.bal_account_content_type_id),
    bal_account_object_id: asNumber(row.bal_account_object_id),
    bal_account_name: asString(row.bal_account_name) || undefined,
    status: asString(row.status, 'Open') || 'Open',
    application_status: asString(row.application_status, '') || '',
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
  };
}

export function mapPageDataBankAccount(row: PageDataRecord): BankAccount {
  return {
    id: asOptionalNumber(row.id),
    no: asString(row.no),
    name: asString(row.name),
    bank_account_no: asString(row.bank_account_no) || undefined,
    bank_account_posting_group:
      asString(row.bank_account_posting_group) || undefined,
  };
}

export function mapPageDataBankLedger(
  row: PageDataRecord,
): BankAccountLedgerEntry {
  return {
    entry_no: asOptionalNumber(row.entry_no ?? row.id),
    bank_account_no: asString(row.bank_account_no ?? row.bank_account),
    bank_account_name: asString(row.bank_account_name) || undefined,
    posting_date: asString(row.posting_date),
    document_no: asString(row.document_no),
    document_type: asString(row.document_type) || undefined,
    description: asString(row.description) || undefined,
    debit_amount: asOptionalNumber(row.debit_amount),
    credit_amount: asOptionalNumber(row.credit_amount),
    balance: asOptionalNumber(row.balance),
  };
}

export function mapPageDataPaymentMethod(row: PageDataRecord) {
  return {
    id: asNumber(row.id),
    code: asString(row.code),
    description: asString(row.description),
    bal_account_type: asString(row.bal_account_type),
    bal_account_no: asString(row.bal_account_no),
    system_id: systemIdOf(row),
    requires_amount_received: Boolean(row.requires_amount_received),
    blocked: Boolean(row.blocked),
  };
}

export function mapPageDataCategory(row: PageDataRecord) {
  return {
    code: asString(row.code),
    description: asString(row.description ?? row.name),
    name: asString(row.description ?? row.name ?? row.code),
    parent_id: row.parent != null && row.parent !== ''
      ? asString(row.parent)
      : row.parent_id != null
        ? asString(row.parent_id)
        : null,
    level: asOptionalNumber(row.indentation ?? row.level),
    system_id: systemIdOf(row),
    id: asString(row.code) || asOptionalNumber(row.id),
  };
}

export function mapPageDataUnitOfMeasure(row: PageDataRecord) {
  return {
    code: asString(row.code),
    description: asString(row.description),
    system_id: systemIdOf(row),
  };
}

export function mapPageDataItemJournal(row: PageDataRecord) {
  return {
    id: asOptionalNumber(row.id),
    system_id: systemIdOf(row),
    document_no: asString(row.document_no),
    entry_type: asString(row.entry_type),
    item: row.item,
    item_no: asString(row.item ?? row.item_no),
    item_name: asString(row.item_name ?? row.item),
    quantity: asNumber(row.quantity),
    unit_amount: asNumber(row.unit_amount),
    amount: asNumber(row.amount),
    date: asString(row.date ?? row.posting_date),
    status: asString(row.status, 'Open') || 'Open',
    adjustment_type: asString(row.adjustment_type) || undefined,
  };
}

export function mapPageDataUser(row: PageDataRecord): User {
  return {
    id: asNumber(row.id),
    email: asString(row.email),
    username: asString(row.username),
    full_name: asString(row.full_name),
    phone_number: asString(row.phone_number),
    is_active: row.is_active !== false,
    is_staff: Boolean(row.is_staff),
    is_superuser: Boolean(row.is_superuser),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
  };
}

export function mapPageDataUserGroup(row: PageDataRecord): UserGroup {
  return {
    id: asNumber(row.id),
    code: asString(row.code),
    name: asString(row.name),
    description: asString(row.description) || undefined,
    is_active: row.is_active !== false,
  };
}

export function mapPageDataGLAccount(row: PageDataRecord) {
  return {
    id: asOptionalNumber(row.id),
    no: asString(row.no),
    name: asString(row.name),
    system_id: systemIdOf(row),
    indentation: asOptionalNumber(row.indentation) ?? 0,
  };
}
