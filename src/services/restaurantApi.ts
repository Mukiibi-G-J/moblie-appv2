/**
 * Tenant restaurant API — paths mirror web RestaurantService (BaseService /api prefix).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createAxiosInstance} from '../axios/axios';

const API = '/api/restaurant';

async function tenantClient() {
  const tenant = (await AsyncStorage.getItem('tenant')) || undefined;
  return createAxiosInstance(tenant);
}

export type RestaurantFloor = {
  id: number;
  name: string;
  display_order: number;
};

export type RestaurantTable = {
  id: number;
  no: string;
  table_number: string;
  floor?: number;
  floor_name?: string;
  section?: number | null;
  section_name?: string;
  status: string;
  status_display: string;
  capacity: number;
};

export type RestaurantOrderItem = {
  id: number;
  order: number;
  item: string;
  item_no?: string;
  item_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: string;
  status_display: string;
  routes_to_kitchen?: boolean;
  special_instructions?: string;
  fire_state?: string;
  fire_state_display?: string;
  /** From API after serializer update; menu fallback used if absent. */
  primary_image_url?: string | null;
};

export type RestaurantOrder = {
  id: number;
  no: string;
  /** Table FK; null for counter / quick sale. */
  table?: number | null;
  /** Bill-to sales customer FK when set on the order header. */
  customer?: number | null;
  table_number?: string;
  customer_name?: string;
  waiter: number;
  waiter_name?: string;
  status: string;
  status_display: string;
  order_type: string;
  order_type_display: string;
  covers?: number | null;
  total_amount: number;
  order_items?: RestaurantOrderItem[];
  sales_invoice?: number;
  created_at: string;
  active_checks?: Array<{id: number; name?: string}>;
};

export type OpenPosPayload = {
  table: RestaurantTable | null;
  active_orders: RestaurantOrder[];
  active_checks_count: number;
  unsent_items_count: number;
  fired_items_count: number;
};

export type RestaurantMenu = {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
};

export type PosTreeMenuItem = {
  id: number;
  item_no: string;
  item_name: string;
  unit_price: number;
  tile_accent_color?: string;
  kitchen_facing_name?: string;
  routes_to_kitchen?: boolean;
  display_order?: number;
  pos_stock_tracked?: boolean;
  pos_available_qty?: number | null;
  pos_out_of_stock?: boolean;
  /** Absolute or same-origin URL from server `pos-tree` payload. */
  primary_image_url?: string | null;
};

export async function fetchFloors() {
  const client = await tenantClient();
  const res = await client.get<{results: RestaurantFloor[]; count: number}>(
    `${API}/floors/`,
    {params: {page_size: 200, ordering: 'display_order'}},
  );
  return res.data;
}

export async function fetchTables(params?: {
  page_size?: number;
  ordering?: string;
}) {
  const client = await tenantClient();
  const res = await client.get<{results: RestaurantTable[]; count: number}>(
    `${API}/tables/`,
    {params: {page_size: 200, ...params}},
  );
  return res.data;
}

export async function openPosSession(tableId: number) {
  const client = await tenantClient();
  const res = await client.post<OpenPosPayload>(
    `${API}/tables/${tableId}/open-pos/`,
  );
  return res.data;
}

export async function createRestaurantOrder(data: {
  table?: number;
  waiter: number;
  order_type: 'dine_in' | 'takeout';
  covers?: number | null;
}) {
  const client = await tenantClient();
  const res = await client.post<RestaurantOrder>(`${API}/orders/`, data);
  return res.data;
}

export async function fetchOrder(orderId: number) {
  const client = await tenantClient();
  const res = await client.get<RestaurantOrder>(`${API}/orders/${orderId}/`);
  return res.data;
}

export async function fetchOrders(params?: {
  page_size?: number;
  ordering?: string;
  status?: string;
}) {
  const client = await tenantClient();
  const res = await client.get<{results: RestaurantOrder[]; count: number}>(
    `${API}/orders/`,
    {params: {page_size: 200, ordering: '-created_at', ...params}},
  );
  return res.data;
}

export async function addItemsToOrder(
  orderId: number,
  items: Array<{
    item: string;
    quantity: number;
    unit_price: number;
    seat_no?: number | null;
    special_instructions?: string | null;
  }>,
): Promise<RestaurantOrder> {
  const client = await tenantClient();
  const res = await client.post<RestaurantOrder>(
    `${API}/orders/${orderId}/add-items/`,
    {order_items: items},
  );
  return res.data;
}

/** Remove unfired lines or cancel sent lines (matches web POS). */
export async function deleteOrCancelOrderItem(orderItemId: number): Promise<void> {
  const client = await tenantClient();
  await client.post(
    `${API}/order-items/${orderItemId}/delete-or-cancel/`,
    {},
  );
}

export async function fireOrder(orderId: number, itemIds?: number[]) {
  const client = await tenantClient();
  const res = await client.post(`${API}/orders/${orderId}/fire/`, {
    ...(itemIds?.length ? {item_ids: itemIds} : {}),
  });
  return res.data;
}

/** Uninvoiced checks only — matches web `RestaurantService.deleteOrder`. */
export async function deleteRestaurantOrder(orderId: number): Promise<void> {
  const client = await tenantClient();
  await client.delete(`${API}/orders/${orderId}/`);
}

/** Best-effort remove zero-line checks on POS exit (no dedicated `/cancel/` route). */
export async function cancelEmptyOrder(orderId: number): Promise<void> {
  await deleteRestaurantOrder(orderId);
}

export async function recalculateOrderTotal(orderId: number): Promise<{
  message: string;
  old_total: string;
  new_total: string;
  order: RestaurantOrder;
}> {
  const client = await tenantClient();
  const res = await client.post(`${API}/orders/${orderId}/recalculate_total/`);
  return res.data;
}

export async function fetchActiveMenus(locationId?: number) {
  const client = await tenantClient();
  const res = await client.get<RestaurantMenu[]>(
    `${API}/menus/active-for-location/`,
    {params: locationId ? {location_id: locationId} : {}},
  );
  return res.data;
}

export type MenuPosTreeResponse = {
  menu: number;
  root_groups: Array<{
    id: number;
    name: string;
    children?: Array<unknown>;
    items?: PosTreeMenuItem[];
  }>;
  ungrouped_items: PosTreeMenuItem[];
};

export async function fetchMenuPosTree(menuId: number) {
  const client = await tenantClient();
  const res = await client.get<MenuPosTreeResponse>(
    `${API}/menus/${menuId}/pos-tree/`,
  );
  return res.data;
}

export function flattenPosTree(tree: MenuPosTreeResponse): PosTreeMenuItem[] {
  const out: PosTreeMenuItem[] = [...(tree.ungrouped_items || [])];
  for (const g of tree.root_groups || []) {
    if (g.items?.length) {
      out.push(...g.items);
    }
    const children = g.children as
      | Array<{items?: PosTreeMenuItem[]; children?: unknown[]}>
      | undefined;
    if (children?.length) {
      for (const c of children) {
        if (c.items?.length) {
          out.push(...c.items);
        }
      }
    }
  }
  return out;
}

export async function fetchKitchenItems() {
  const client = await tenantClient();
  const res = await client.get<RestaurantOrderItem[]>(
    `${API}/order-items/kitchen_items/`,
  );
  return res.data;
}

export async function startPreparingOrderItems(itemIds: number[]) {
  const client = await tenantClient();
  const res = await client.post<RestaurantOrderItem[]>(
    `${API}/order-items/start-preparing/`,
    {item_ids: itemIds},
  );
  return res.data;
}

export async function updateOrderItemStatus(itemId: number, status: string) {
  const client = await tenantClient();
  const res = await client.post<RestaurantOrderItem>(
    `${API}/order-items/${itemId}/update_status/`,
    {status},
  );
  return res.data;
}

/** Posted sales invoice envelope from checkout-and-post / counter-checkout */
export type RestaurantPostedInvoicePayload = {
  message: string;
  invoice: Record<string, unknown>;
  receipt_no: string;
};

/**
 * Table / dine-in close: create sales invoice, take payment, post G/L + inventory.
 * Backend resolves walk-in customer when order has no bill-to and request omits customer_id.
 */
export async function checkoutAndPostOrder(
  orderId: number,
  body: {
    customer_id?: number | null;
    combine_orders?: boolean;
    payment_method_id: number;
    amount_received?: number | null;
    change_amount?: number | null;
  },
): Promise<RestaurantPostedInvoicePayload> {
  const client = await tenantClient();
  const res = await client.post<RestaurantPostedInvoicePayload>(
    `${API}/orders/${orderId}/checkout-and-post/`,
    {
      combine_orders: body.combine_orders ?? false,
      payment_method_id: body.payment_method_id,
      amount_received:
        body.amount_received !== undefined ? body.amount_received : undefined,
      change_amount:
        body.change_amount !== undefined ? body.change_amount : undefined,
      ...(body.customer_id != null ? {customer_id: body.customer_id} : {}),
    },
  );
  return res.data;
}

/** Quick sale / counter: pay + post in one step (no table orders only). */
export async function counterCheckoutOrder(
  orderId: number,
  body: {
    payment_method_id: number;
    customer_id?: number | null;
    amount_received?: number | null;
    change_amount?: number | null;
  },
): Promise<RestaurantPostedInvoicePayload> {
  const client = await tenantClient();
  const res = await client.post<RestaurantPostedInvoicePayload>(
    `${API}/orders/${orderId}/counter-checkout/`,
    body,
  );
  return res.data;
}

/** Route to counter-checkout (no table FK) or checkout-and-post (seated). */
export async function settleRestaurantOrder(
  order: RestaurantOrder,
  paymentMethodId: number,
  opts?: {amount_received?: number; change_amount?: number},
): Promise<RestaurantPostedInvoicePayload> {
  const total = Math.round(Number(order.total_amount || 0));
  const tendered = opts?.amount_received ?? total;
  const change = opts?.change_amount ?? Math.max(0, tendered - total);
  const body = {
    payment_method_id: paymentMethodId,
    amount_received: tendered,
    change_amount: change,
  };

  const tbl = order.table;
  const noTable = tbl === null || tbl === undefined;

  if (noTable) {
    return counterCheckoutOrder(order.id, {
      ...body,
      customer_id:
        order.customer != null && order.customer !== undefined
          ? Number(order.customer)
          : undefined,
    });
  }

  return checkoutAndPostOrder(order.id, {
    ...body,
    combine_orders: false,
    ...(order.customer != null && order.customer !== undefined
      ? {customer_id: Number(order.customer)}
      : {}),
  });
}

/**
 * Legacy: marks order completed only — does not invoice or post.
 * Prefer checkoutAndPostOrder / counterCheckoutOrder for cashier close-out.
 */
export async function completeRestaurantOrder(
  orderId: number,
): Promise<RestaurantOrder> {
  const client = await tenantClient();
  const res = await client.post<RestaurantOrder>(
    `${API}/orders/${orderId}/complete/`,
    {},
  );
  return res.data;
}

/**
 * Fetch a printable HTML receipt for an order.
 * Falls back to building one client-side if the endpoint doesn't exist (404).
 */
export async function fetchOrderReceipt(
  orderId: number,
): Promise<string | null> {
  try {
    const client = await tenantClient();
    const res = await client.get<{html: string}>(
      `${API}/orders/${orderId}/receipt/`,
    );
    return res.data.html ?? null;
  } catch {
    return null;
  }
}

export async function fetchDashboardStats() {
  const client = await tenantClient();
  const res = await client.get<{
    active_tables: number;
    pending_orders: number;
    today_reservations: number;
    today_revenue: number;
  }>(`${API}/dashboard/stats/`);
  return res.data;
}
