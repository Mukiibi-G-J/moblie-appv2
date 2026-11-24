import {
  appendHowToPayNodes,
  parsePayeeLines,
  sectionFlag,
  thanksSecondLine,
} from "./blockOptions";
import {
  appendEfrisFiscalNodes,
  appendMandatoryEfrisFiscal,
} from "./efrisFiscal";
import { compileFormatStringToNodes } from "./formatStringCompiler";
import { appendMandatorySystemFooter } from "./systemFooter";
import {
  cleanPaymentMethodLabel,
  effectiveReceiptCols,
  fitReceiptCompanyName,
  formatKotQty,
  formatReceiptAmount,
  formatReceiptDate,
  padReceiptColumns,
} from "./formatters";
import type {
  KotBarPayload,
  PaymentJournalPayload,
  ReceiptBranding,
  ReceiptBuildPayload,
  ReceiptDocument,
  ReceiptDocumentNode,
  ReceiptLineItem,
  ResolvedReceiptTemplate,
  SaleReceiptPayload,
  TemplateSection,
} from "./types";

function enabledSections(template: ResolvedReceiptTemplate): TemplateSection[] {
  return [...(template.sections || [])]
    .filter((s) => s.enabled !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function lineTotal(item: {
  quantity: number | string;
  unit_price?: number | string;
  total_price?: number | string;
  total_amount?: number | string;
  line_total?: number;
}): number {
  if (item.line_total != null && Number.isFinite(item.line_total)) {
    return item.line_total;
  }
  const tp = item.total_price ?? item.total_amount;
  if (tp != null) {
    const v = typeof tp === "string" ? parseFloat(tp) : tp;
    if (Number.isFinite(v)) return v;
  }
  const q = Number(item.quantity) || 0;
  const u = Number(item.unit_price) || 0;
  return q * u;
}

function hasPrintableLogo(logo?: string | null): boolean {
  if (!logo?.trim()) {
    return false;
  }
  return !logo.includes("company_logos/default.png");
}

function isDroppedReceiptTitle(text: string): boolean {
  const t = text.trim();
  return /^guest\s*check$/i.test(t) || /^sales\s*receipt$/i.test(t);
}

function pushCompanyName(
  nodes: ReceiptDocumentNode[],
  branding: ReceiptBranding,
  cols = 32,
): void {
  const name = fitReceiptCompanyName(
    branding.displayName || branding.name || "",
    cols,
  );
  if (!name) {
    return;
  }
  nodes.push({
    type: "text",
    text: name,
    style: { align: "center" },
  });
}

function buildSaleSection(
  section: TemplateSection,
  payload: SaleReceiptPayload,
  branding: ReceiptBranding,
  cols: number,
  nodes: ReceiptDocumentNode[],
): void {
  const isPrepayment = payload.receiptType === "prepayment";
  const cfg = section.config || {};

  switch (section.id) {
    case "logo":
      if (hasPrintableLogo(branding.logo)) {
        const large = sectionFlag(cfg, "large", false);
        nodes.push({
          type: "image",
          src: branding.logo as string,
          style: { align: "center" },
          ...(large ? { maxWidthMm: 42, maxHeightMm: 22 } : {}),
        });
      }
      break;
    case "title": {
      const title = String(cfg.text || (isPrepayment ? "PAYMENT RECEIPT" : "")).trim();
      if (!title || isDroppedReceiptTitle(title)) {
        break;
      }
      nodes.push({
        type: "text",
        text: title,
        style: { align: "center", bold: true },
      });
      break;
    }
    case "company_block": {
      pushCompanyName(nodes, branding, cols);
      if (sectionFlag(cfg, "showAddress", true) && branding.address) {
        nodes.push({ type: "text", text: branding.address, style: { align: "center" } });
      }
      if (sectionFlag(cfg, "showPhone", true) && branding.phone) {
        nodes.push({ type: "text", text: branding.phone, style: { align: "center" } });
      }
      if (sectionFlag(cfg, "showEmail", false) && branding.email) {
        nodes.push({ type: "text", text: branding.email, style: { align: "center" } });
      }
      if (sectionFlag(cfg, "showTin", false) && branding.tin) {
        nodes.push({ type: "text", text: `TIN: ${branding.tin}`, style: { align: "center" } });
      }
      if (sectionFlag(cfg, "showVat", true) && branding.vatNo) {
        nodes.push({ type: "text", text: `VAT No: ${branding.vatNo}`, style: { align: "center" } });
      }
      nodes.push({ type: "rule" });
      break;
    }
    case "branch_line": {
      const branch = (branding.branchCode || "").split(/\r?\n/)[0]?.trim();
      const companyName = (branding.displayName || branding.name || "").trim();
      if (branch && branch.toLowerCase() !== companyName.toLowerCase()) {
        nodes.push({ type: "text", text: branch, style: { align: "center", bold: true } });
      }
      break;
    }
    case "receipt_meta":
      if (
        sectionFlag(cfg, "showDocumentNo", true) &&
        !isPrepayment &&
        payload.invoiceNo
      ) {
        nodes.push({
          type: "row",
          left: "Receipt",
          right: payload.invoiceNo,
        });
      }
      if (sectionFlag(cfg, "showDateTime", true)) {
        nodes.push({
          type: "row",
          left: "Date",
          right: formatReceiptDate(payload.documentDate),
        });
      }
      if (sectionFlag(cfg, "showCashier", true) && payload.sellerName) {
        nodes.push({
          type: "row",
          left: "Till",
          right: payload.sellerName,
        });
      }
      nodes.push({ type: "rule" });
      break;
    case "customer_line":
      if (payload.customerName && payload.customerName !== "General") {
        nodes.push({ type: "text", text: `Customer: ${payload.customerName}` });
        if (payload.customerNo) {
          nodes.push({ type: "text", text: `Account: ${payload.customerNo}` });
        }
        if (isPrepayment) {
          nodes.push({ type: "text", text: `This payment #: ${payload.invoiceNo}`, style: { bold: true } });
          if (payload.prepaymentDocumentNo) {
            nodes.push({ type: "text", text: `Order #: ${payload.prepaymentDocumentNo}` });
          }
        }
      }
      break;
    case "line_items_compact":
    case "line_items": {
      for (const item of payload.lines) {
        const lt = lineTotal(item);
        const qty = formatKotQty(item.quantity);
        const name = (item.item_name || "Item").trim();
        nodes.push({
          type: "row",
          left: `${qty}x ${name}`,
          right: formatReceiptAmount(lt),
        });
      }
      nodes.push({ type: "rule" });
      break;
    }
    case "vat_breakdown":
      if (
        !isPrepayment &&
        payload.vatEnabled &&
        payload.vatAmount != null &&
        Number(payload.vatAmount) > 0
      ) {
        nodes.push({
          type: "row",
          left: "Subtotal (excl. VAT):",
          right: formatReceiptAmount(
            payload.totalExclVat ??
              payload.totalAmount - Number(payload.vatAmount),
          ),
        });
        nodes.push({
          type: "row",
          left: "VAT Amount:",
          right: formatReceiptAmount(payload.vatAmount),
        });
      }
      break;
    case "totals":
      nodes.push({
        type: "row",
        left: isPrepayment ? "Total" : "TOTAL",
        right: formatReceiptAmount(payload.totalAmount),
        style: { bold: true },
      });
      if (payload.discount && payload.discount > 0) {
        nodes.push({
          type: "row",
          left: "Discount:",
          right: `-${formatReceiptAmount(payload.discount)}`,
        });
      }
      if (payload.tax && payload.tax > 0) {
        nodes.push({ type: "row", left: "Tax:", right: formatReceiptAmount(payload.tax) });
      }
      break;
    case "tender_change":
      if (isPrepayment) {
        if (payload.amountReceived != null) {
          nodes.push({
            type: "row",
            left: "Paid today:",
            right: formatReceiptAmount(payload.amountReceived),
            style: { bold: true },
          });
        }
        if (payload.remainingBalance != null) {
          nodes.push({
            type: "row",
            left: "Still to pay:",
            right: formatReceiptAmount(payload.remainingBalance),
            style: { bold: true },
          });
        }
      } else {
        nodes.push({
          type: "row",
          left: cleanPaymentMethodLabel(payload.paymentMethod) || "Cash",
          right: formatReceiptAmount(
            payload.amountReceived ?? payload.totalAmount,
          ),
        });
        nodes.push({
          type: "row",
          left: "Change",
          right: formatReceiptAmount(payload.changeAmount ?? 0),
        });
      }
      break;
    case "payment_method":
      if (!isPrepayment) break;
      if (
        payload.paymentMethod &&
        payload.paymentMethodCode !== "NOT_PAID"
      ) {
        nodes.push({
          type: "row",
          left: "Paid with:",
          right: cleanPaymentMethodLabel(payload.paymentMethod),
        });
      }
      break;
    case "footer_thanks": {
      nodes.push({
        type: "text",
        text: String(cfg.text || "Thank you for your purchase!"),
        style: { align: "center" },
      });
      const second = thanksSecondLine(cfg, "Please come again");
      if (second) {
        nodes.push({ type: "text", text: second, style: { align: "center" } });
      }
      break;
    }
    case "how_to_pay":
      appendHowToPayNodes(nodes, branding, payload.payeeLines);
      break;
    case "footer_marketing": {
      const lines =
        (cfg.lines as string[])?.length > 0
          ? (cfg.lines as string[])
          : [
              "www.zentroapp.app",
              "Contact: 0750440865 / 0779899789",
              "Powered by Zentroapp",
            ];
      nodes.push({ type: "rule" });
      for (const ln of lines) {
        nodes.push({ type: "text", text: ln, style: { align: "center" } });
      }
      break;
    }
    case "footer_receipt_id":
      if (payload.invoiceNo) {
        nodes.push({
          type: "text",
          text: `Receipt ID: ${payload.invoiceNo}`,
          style: { align: "center", bold: true },
        });
      }
      break;
    case "qr_code":
      appendEfrisFiscalNodes(nodes, payload);
      break;
    default:
      break;
  }
  void cols;
}

function pushLogoNode(
  nodes: ReceiptDocumentNode[],
  branding: ReceiptBranding,
  cfg: Record<string, unknown>,
): void {
  if (!hasPrintableLogo(branding.logo)) {
    return;
  }
  const large = sectionFlag(cfg, "large", false);
  nodes.push({
    type: "image",
    src: branding.logo as string,
    style: { align: "center" },
    ...(large ? { maxWidthMm: 42, maxHeightMm: 22 } : {}),
  });
}

function buildKotBarSection(
  section: TemplateSection,
  payload: KotBarPayload,
  branding: ReceiptBranding,
  nodes: ReceiptDocumentNode[],
): void {
  const cfg = section.config || {};
  switch (section.id) {
    case "logo":
      pushLogoNode(nodes, branding, cfg);
      break;
    case "title":
      nodes.push({
        type: "text",
        text: String(cfg.text || payload.title || (payload.receiptType === "kot" ? "KITCHEN ORDER" : "BAR ORDER")),
        style: { align: "center", bold: true, double: true },
      });
      nodes.push({ type: "feed", lines: 1 });
      break;
    case "order_meta":
      if (payload.tableLabel) {
        nodes.push({ type: "text", text: payload.tableLabel, style: { align: "center" } });
      }
      if (sectionFlag(cfg, "showDocumentNo", true) && payload.orderNo) {
        nodes.push({ type: "text", text: payload.orderNo, style: { align: "center", bold: true } });
      }
      if (payload.orderTypeDisplay) {
        nodes.push({ type: "text", text: payload.orderTypeDisplay, style: { align: "center" } });
      }
      if (sectionFlag(cfg, "showCashier", true) && payload.waiterName) {
        nodes.push({ type: "text", text: `Server: ${payload.waiterName}`, style: { align: "center" } });
      }
      if (sectionFlag(cfg, "showDateTime", true)) {
        nodes.push({ type: "text", text: formatReceiptDate(payload.printedAt), style: { align: "center" } });
      }
      nodes.push({ type: "rule" });
      break;
    case "items":
      for (const item of payload.items) {
        nodes.push({
          type: "text",
          text: `${item.quantity}× ${item.item_name}`,
          style: { bold: true },
        });
        if (item.seat_no != null || item.special_instructions) {
          const parts = [
            item.seat_no != null ? `Seat ${item.seat_no}` : "",
            item.special_instructions || "",
          ].filter(Boolean);
          if (parts.length) {
            nodes.push({ type: "text", text: `  ${parts.join(" · ")}` });
          }
        }
      }
      nodes.push({ type: "rule" });
      break;
    case "special_instructions":
      for (const item of payload.items) {
        if (item.special_instructions) {
          nodes.push({ type: "text", text: `  ** ${item.special_instructions}` });
        }
        if (item.fire_state_display) {
          nodes.push({ type: "text", text: `  [${item.fire_state_display}]` });
        }
      }
      break;
    case "kitchen_copy_label":
      nodes.push({
        type: "text",
        text: String(cfg.text || "*** KITCHEN COPY ***"),
        style: { align: "center", bold: true },
      });
      nodes.push({ type: "feed", lines: 1 });
      break;
    default:
      break;
  }
}

function buildPaymentJournalSection(
  section: TemplateSection,
  payload: PaymentJournalPayload,
  branding: ReceiptBranding,
  nodes: ReceiptDocumentNode[],
  cols = 32,
): void {
  const cfg = section.config || {};
  switch (section.id) {
    case "logo":
      pushLogoNode(nodes, branding, cfg);
      break;
    case "title":
      nodes.push({
        type: "text",
        text: String(cfg.text || "PAYMENT RECEIPT"),
        style: { align: "center", bold: true, double: true },
      });
      break;
    case "company_block":
      pushCompanyName(nodes, branding, cols);
      if (sectionFlag(cfg, "showAddress", true) && branding.address) {
        nodes.push({ type: "text", text: branding.address, style: { align: "center" } });
      }
      if (sectionFlag(cfg, "showPhone", true) && branding.phone) {
        nodes.push({ type: "text", text: branding.phone, style: { align: "center" } });
      }
      if (sectionFlag(cfg, "showEmail", false) && branding.email) {
        nodes.push({ type: "text", text: branding.email, style: { align: "center" } });
      }
      if (sectionFlag(cfg, "showTin", false) && branding.tin) {
        nodes.push({ type: "text", text: `TIN: ${branding.tin}`, style: { align: "center" } });
      }
      if (sectionFlag(cfg, "showVat", true) && branding.vatNo) {
        nodes.push({ type: "text", text: `VAT No: ${branding.vatNo}`, style: { align: "center" } });
      }
      break;
    case "receipt_meta":
      if (sectionFlag(cfg, "showDocumentNo", true)) {
        nodes.push({ type: "text", text: `Document: ${payload.documentNo}` });
      }
      if (sectionFlag(cfg, "showDateTime", true)) {
        nodes.push({ type: "text", text: `Date: ${formatReceiptDate(payload.documentDate)}` });
      }
      nodes.push({ type: "rule" });
      break;
    case "line_items":
      for (const line of payload.lines) {
        nodes.push({
          type: "row",
          left: String(line.item_name),
          right: formatReceiptAmount(lineTotal(line)),
        });
      }
      nodes.push({ type: "rule" });
      break;
    case "totals":
      nodes.push({
        type: "row",
        left: "TOTAL:",
        right: formatReceiptAmount(payload.totalAmount),
        style: { bold: true },
      });
      break;
    case "payment_method":
      if (payload.paymentMethod) {
        nodes.push({ type: "row", left: "Payment:", right: payload.paymentMethod });
      }
      break;
    case "how_to_pay":
      appendHowToPayNodes(nodes, branding, payload.payeeLines);
      break;
    case "footer_thanks": {
      nodes.push({
        type: "text",
        text: String(cfg.text || "THANK YOU"),
        style: { align: "center", bold: true },
      });
      const second = thanksSecondLine(cfg, "");
      if (second) {
        nodes.push({ type: "text", text: second, style: { align: "center" } });
      }
      break;
    }
    default:
      break;
  }
}

export function buildReceiptDocument(
  payload: ReceiptBuildPayload,
  template: ResolvedReceiptTemplate,
  branding: ReceiptBranding,
): ReceiptDocument {
  const cols = effectiveReceiptCols(
    template.paperProfile?.charsPerLine ?? 42,
    template.paperProfile?.widthMm ?? 58,
  );
  const nodes: ReceiptDocumentNode[] = [];

  if (
    template.editorMode === "format_string" &&
    (template.formatString || "").trim()
  ) {
    nodes.push(
      ...compileFormatStringToNodes(
        template.formatString || "",
        payload,
        branding,
        cols,
      ),
    );
    appendMandatoryEfrisFiscal(nodes, payload);
    appendMandatorySystemFooter(nodes, payload, template.sections);
    nodes.push({ type: "cut" });
    return {
      paperProfile: template.paperProfile || {},
      nodes,
    };
  }

  for (const section of enabledSections(template)) {
    if (payload.receiptType === "kot" || payload.receiptType === "bar") {
      buildKotBarSection(section, payload as KotBarPayload, branding, nodes);
    } else if (payload.receiptType === "payment_journal") {
      buildPaymentJournalSection(
        section,
        payload as PaymentJournalPayload,
        branding,
        nodes,
        cols,
      );
    } else {
      buildSaleSection(
        section,
        payload as SaleReceiptPayload,
        branding,
        cols,
        nodes,
      );
    }
  }

  appendMandatoryEfrisFiscal(nodes, payload);
  appendMandatorySystemFooter(nodes, payload, template.sections);
  nodes.push({ type: "cut" });

  return {
    paperProfile: template.paperProfile || {},
    nodes,
  };
}

/** Map web ReceiptData to SaleReceiptPayload */
export function receiptDataToSalePayload(data: {
  invoice: Record<string, unknown>;
  sellerInfo?: { name?: string };
}): SaleReceiptPayload {
  const inv = data.invoice;
  const lines = (inv.lines as ReceiptLineItem[]) || [];
  const totalAmount =
    Number(inv.total_amount) ||
    lines.reduce((sum, line) => sum + lineTotal(line), 0);
  return {
    receiptType: inv.receipt_variant === "prepayment" ? "prepayment" : "sale",
    invoiceNo: String(inv.invoice_no || ""),
    documentDate: String(inv.document_date || new Date().toISOString()),
    customerName: inv.customer_name as string | undefined,
    customerNo: inv.customer_no as string | undefined,
    lines,
    totalAmount,
    vatEnabled: Boolean(inv.vat_enabled),
    vatAmount: inv.vat_amount as number | undefined,
    totalExclVat: inv.total_excl_vat as number | undefined,
    amountReceived: inv.amount_received as number | undefined,
    changeAmount: inv.change_amount as number | undefined,
    paymentMethod: (inv.payment_method_details as { description?: string })
      ?.description,
    paymentMethodCode: (inv.payment_method_details as { code?: string })?.code,
    sellerName: data.sellerInfo?.name,
    prepaymentDocumentNo: inv.prepayment_document_no as string | undefined,
    remainingBalance: inv.remaining_balance as number | undefined,
    efrisFdn: inv.efris_fdn as string | undefined,
    efrisVerificationCode: inv.efris_verification_code as string | undefined,
    efrisQrCode: inv.efris_qr_code as string | undefined,
    payeeLines: parsePayeeLines(inv.payee_lines ?? inv.payeeLines),
  };
}

/** Map mobile PrintReceiptData to SaleReceiptPayload */
export function mobilePrintDataToSalePayload(data: {
  cartItems: Array<{
    item_name: string;
    quantity: number;
    unit_price: number;
    line_total?: number;
  }>;
  total: number;
  subtotal?: number;
  tax?: number;
  discount?: number;
  receiptId?: string;
  saleDate?: string;
  username: string;
  customerName?: string;
  amountReceived?: number;
  change?: number;
  paymentMethod?: string;
  payeeLines?: SaleReceiptPayload["payeeLines"];
  vatEnabled?: boolean;
  vatAmount?: number;
  totalExclVat?: number;
  efrisFdn?: string;
  efrisVerificationCode?: string;
  efrisQrCode?: string;
}): SaleReceiptPayload {
  return {
    receiptType: "sale",
    invoiceNo: data.receiptId || "N/A",
    documentDate: data.saleDate || new Date().toISOString(),
    customerName: data.customerName,
    lines: data.cartItems.map((i) => ({
      item_name: i.item_name,
      quantity: i.quantity,
      unit_price: i.unit_price,
      line_total: i.line_total,
    })),
    totalAmount: data.total,
    subtotal: data.subtotal,
    tax: data.tax,
    discount: data.discount,
    vatEnabled: data.vatEnabled,
    vatAmount: data.vatAmount,
    totalExclVat: data.totalExclVat,
    amountReceived: data.amountReceived,
    changeAmount: data.change,
    paymentMethod: data.paymentMethod,
    sellerName: data.username,
    payeeLines: data.payeeLines,
    efrisFdn: data.efrisFdn,
    efrisVerificationCode: data.efrisVerificationCode,
    efrisQrCode: data.efrisQrCode,
  };
}
