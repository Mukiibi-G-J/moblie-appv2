import type {CartItem} from '../@types/types.dto';

export interface CartLineForPayload {
  id?: string;
  no?: string;
  name?: string;
  item_name?: string;
  quantity: number;
  price?: number;
  unit_price?: number;
  unit_of_measure?: string;
  quantity_per_unit?: number;
  line_discount_amount?: number;
  tracking_code?: string;
  selectedTrackingCode?: string;
  selectedLotNo?: string;
  selectedSerialNos?: string[];
}

export function cartItemToLine(item: CartItem): CartLineForPayload {
  const requiresSerial = Boolean(item.tracking_code?.require_serial_no);
  const lot =
    !requiresSerial && item.tracking_code?.require_lot_no
      ? item.selectedTrackingCode
      : requiresSerial
        ? ''
        : item.selectedTrackingCode;
  return {
    id: String(item.item_id ?? item.system_id ?? item.no ?? ''),
    no: item.no || item.system_id,
    name: item.item_name,
    item_name: item.item_name,
    quantity: item.quantity,
    price: item.unit_price,
    unit_price: item.unit_price,
    unit_of_measure: item.unit_of_measure,
    quantity_per_unit: item.quantity_per_unit || 1,
    line_discount_amount: 0,
    tracking_code: lot || '',
    selectedTrackingCode: lot || '',
    selectedLotNo: lot || '',
    selectedSerialNos: item.selectedSerialNos,
  };
}

export function buildSalesInvoicePayload(options: {
  systemId: string;
  customerId?: number | null;
  customerName: string;
  paymentMethodId?: number | null;
  amountReceived: number;
  changeAmount: number;
  lines: CartLineForPayload[];
  documentDate?: string;
}) {
  const totalAmount = options.lines.reduce((sum, line) => {
    const unitPrice = line.unit_price ?? line.price ?? 0;
    return sum + unitPrice * line.quantity;
  }, 0);

  return {
    system_id: options.systemId,
    customer: options.customerId ?? undefined,
    customer_name: options.customerName,
    document_date:
      options.documentDate || new Date().toISOString().slice(0, 10),
    status: 'Open' as const,
    total_amount: totalAmount,
    amount_received: options.amountReceived,
    change_amount: options.changeAmount,
    payment_method: options.paymentMethodId,
    invoice_discount_amount: '0',
    invoice_discount_percentage: '0',
    lines: options.lines.map((item, index) => {
      // Cart unit_price is the UOM sell price (price list resolve). Match web: send as-is.
      const unitPrice = item.unit_price ?? item.price ?? 0;
      const name = item.item_name ?? item.name ?? '';
      const itemNo = item.no ?? '';
      return {
        id: index + 1,
        item: itemNo,
        item_no: itemNo,
        item_name: name,
        quantity: String(item.quantity),
        unit_price: String(unitPrice),
        total_amount: String(unitPrice * item.quantity),
        line_discount_amount: String(item.line_discount_amount || 0),
        unit_of_measure: item.unit_of_measure || 'PCS',
        description: '',
        tracking_code:
          item.selectedLotNo || item.selectedTrackingCode || item.tracking_code || '',
        serial_nos: Array.isArray(item.selectedSerialNos)
          ? item.selectedSerialNos
          : [],
      };
    }),
  };
}
