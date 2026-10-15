import type {RestaurantOrder} from '../services/restaurantApi';

export function buildReceiptHtml(order: RestaurantOrder): string {
  const items = (order.order_items || [])
    .map(
      i => `
        <tr>
          <td style="padding:4px 0">${i.item_name || i.item}</td>
          <td style="text-align:center;padding:4px 8px">x${i.quantity}</td>
          <td style="text-align:right;padding:4px 0">
            ${Number(i.total_price || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}
          </td>
        </tr>`,
    )
    .join('');

  const total = Number(order.total_amount || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });

  return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <style>
          body { font-family: monospace; font-size: 13px; padding: 16px; max-width: 320px; margin: 0 auto; }
          h2 { text-align: center; font-size: 16px; margin-bottom: 4px; }
          .sub { text-align: center; color: #555; font-size: 12px; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; }
          thead th { border-bottom: 1px dashed #000; padding-bottom: 6px; }
          tfoot td { border-top: 1px dashed #000; padding-top: 6px; font-weight: bold; }
          .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #777; }
        </style>
      </head>
      <body>
        <h2>RECEIPT</h2>
        <p class="sub">
          ${order.no}<br/>
          ${order.order_type_display}
          ${order.table_number ? ' · Table ' + order.table_number : ''}<br/>
          ${new Date().toLocaleString()}
        </p>
        <table>
          <thead>
            <tr>
              <th style="text-align:left">Item</th>
              <th>Qty</th>
              <th style="text-align:right">Amount</th>
            </tr>
          </thead>
          <tbody>${items}</tbody>
          <tfoot>
            <tr>
              <td colspan="2">TOTAL</td>
              <td style="text-align:right">${total}</td>
            </tr>
          </tfoot>
        </table>
        <p class="footer">Thank you for dining with us!</p>
      </body>
      </html>`;
}

export function buildReceiptText(order: RestaurantOrder): string {
  const lines = (order.order_items || [])
    .map(
      i =>
        `${i.item_name || i.item}  x${i.quantity}  ${Number(i.total_price || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}`,
    )
    .join('\n');
  const total = Number(order.total_amount || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
  return [
    `RECEIPT — ${order.no}`,
    `${order.order_type_display}${order.table_number ? ' · Table ' + order.table_number : ''}`,
    new Date().toLocaleString(),
    '─────────────────────',
    lines,
    '─────────────────────',
    `TOTAL: ${total}`,
    'Thank you!',
  ].join('\n');
}
