import type {RestaurantOrder} from './restaurantApi';
import type {PrintReceiptData, CompanyInfo} from './PrintService';

export function restaurantOrderToReceiptData(
  order: RestaurantOrder,
  options?: {
    username?: string;
    companyInfo?: CompanyInfo;
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
    receiptId: order.no,
    saleDate: order.created_at || new Date().toISOString(),
    companyInfo: options?.companyInfo,
    // paymentMethod & change left undefined — restaurant orders
    // don't carry payment detail at this stage
  };
}
