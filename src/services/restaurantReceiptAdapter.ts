import type {
  RestaurantOrder,
  RestaurantPostedInvoicePayload,
} from './restaurantApi';
import type {PrintReceiptData, CompanyInfo} from './PrintService';

/** Best display id for a thermal receipt after checkout-and-post / counter-checkout. */
export function receiptLabelFromPostedPayload(
  payload: RestaurantPostedInvoicePayload,
  orderNoFallback: string,
): string {
  const inv = payload.invoice;
  if (inv && typeof inv === 'object' && inv !== null) {
    const r = inv as Record<string, unknown>;
    const n = r.invoice_no ?? r.document_no ?? r.number;
    if (typeof n === 'string' && n.trim()) {
      return n.trim();
    }
    if (typeof n === 'number' && Number.isFinite(n)) {
      return String(Math.trunc(n));
    }
  }
  const rno = payload.receipt_no;
  if (typeof rno === 'string' && rno.trim()) {
    return rno.trim();
  }
  return orderNoFallback;
}

export function restaurantOrderToReceiptData(
  order: RestaurantOrder,
  options?: {
    username?: string;
    companyInfo?: CompanyInfo;
    /** When set (e.g. after posting), shown as receipt / invoice id on the slip. */
    receiptIdOverride?: string;
    saleDate?: string;
  },
): PrintReceiptData {
  const items = (order.order_items || []).map(i => ({
    item_name: i.item_name || i.item || 'Item',
    quantity: Number(i.quantity) || 1,
    unit_price: Number(i.unit_price) || 0,
  }));

  const total = Number(order.total_amount) || 0;

  return {
    cartItems: items,
    total,
    subtotal: total,
    username: options?.username || order.waiter_name || 'Staff',
    receiptId: options?.receiptIdOverride ?? order.no,
    saleDate: options?.saleDate || order.created_at || new Date().toISOString(),
    companyInfo: options?.companyInfo,
    // paymentMethod & change left undefined — restaurant orders
    // don't carry payment detail at this stage
  };
}
