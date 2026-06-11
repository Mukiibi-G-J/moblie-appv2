import {getCompanyInfo, TenantCompanyApi} from '../services/app.services';
import type {CompanyInfo, PrintReceiptData} from '../services/PrintService';

export function tenantCompanyToReceiptInfo(
  company: TenantCompanyApi,
): CompanyInfo {
  return {
    name: company.name || 'ZENTRO APP',
    logo: company.logo || '',
    address: company.address || '',
    phone: company.phone || '',
    email: company.email || '',
    tin: company.tin || '',
  };
}

/** Load company header fields for thermal receipts. */
export async function fetchCompanyInfoForReceipt(): Promise<
  CompanyInfo | undefined
> {
  try {
    const res = await getCompanyInfo();
    if (res?.data?.company) {
      return tenantCompanyToReceiptInfo(res.data.company);
    }
  } catch (e) {
    console.warn('fetchCompanyInfoForReceipt failed:', e);
  }
  return undefined;
}

/** Sample POS sale used for printer test prints (matches web receipt preview). */
export function buildSampleSaleReceiptData(
  companyInfo?: CompanyInfo,
): PrintReceiptData {
  return {
    cartItems: [
      {
        item_name: 'Sample Item A',
        quantity: 2,
        unit_price: 25000,
        line_total: 50000,
      },
      {
        item_name: 'Sample Item B',
        quantity: 1,
        unit_price: 75000,
        line_total: 75000,
      },
    ],
    total: 125000,
    subtotal: 125000,
    tax: 0,
    discount: 0,
    amountReceived: 130000,
    change: 5000,
    paymentMethod: 'Cash',
    customerName: 'Walk-in Customer',
    receiptId: 'TEST-SALE',
    saleDate: new Date().toISOString(),
    username: 'Test Cashier',
    companyInfo,
    compactReceipt: false,
  };
}
