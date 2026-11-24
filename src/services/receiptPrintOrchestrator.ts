import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchCompanyInfoForReceipt } from "../utils/companyReceiptInfo";
import { isPlaceholderCompanyLogo } from "../utils/companyLogoUrl";
import type { KotData } from "./UsbPrinterService";
import type { CompanyInfo, PrintReceiptData, PrinterType } from "./PrintService";
import { resolveReceiptTemplate } from "./ReceiptTemplateService";
import { parsePayeeLines } from "../shared/receipt/blockOptions";
import {
  buildReceiptDocumentFromTemplate,
  kotTicketDataToPayload,
  mergeBranding,
  mobilePrintDataToSalePayload,
  resolveTemplateFromConfig,
} from "../shared/receipt/receiptRuntime";
import type {
  PayeeLine,
  ReceiptBuildPayload,
  ReceiptDocument,
  ReceiptProcess,
  ReceiptType,
  PrinterType as ApiPrinterType,
  ResolvedReceiptTemplate,
  SaleReceiptPayload,
} from "../shared/receipt/types";

function mapPrinterType(printer: PrinterType): ApiPrinterType {
  if (printer === "sunmi") return "sunmi";
  if (printer === "usb") return "usb";
  return "bluetooth";
}

/** Fit the saved layout onto 58mm paper without changing which blocks print. */
function clampMobilePaperProfile(
  template: ResolvedReceiptTemplate,
  printerType: PrinterType,
): ResolvedReceiptTemplate {
  if (printerType !== "bluetooth" && printerType !== "usb" && printerType !== "sunmi") {
    return template;
  }
  const widthMm = Math.min(template.paperProfile?.widthMm ?? 58, 80);
  const maxCols = widthMm <= 58 ? 32 : 42;
  const chars = template.paperProfile?.charsPerLine ?? maxCols;
  return {
    ...template,
    paperProfile: {
      ...template.paperProfile,
      widthMm,
      charsPerLine: Math.min(chars, maxCols),
      logoWidthPx: Math.min(template.paperProfile?.logoWidthPx ?? 128, widthMm <= 58 ? 128 : 160),
    },
  };
}

function inclusiveVatShare(amount: number, vatPercent = 18): number {
  if (!(amount > 0) || !(vatPercent > 0)) return 0;
  const base = Math.round((amount / (1 + vatPercent / 100)) * 100) / 100;
  return Math.round((amount - base) * 100) / 100;
}

async function salesVatEnabled(): Promise<boolean> {
  try {
    const { getCachedSalesSetup } = await import("../db/sqlite");
    const cached = await getCachedSalesSetup();
    return cached?.vat_enabled === true;
  } catch {
    return false;
  }
}

async function loadBranchCode(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem("branch.active_branch");
    if (!raw) return "";
    const branch = JSON.parse(raw) as { code?: string };
    return String(branch.code || "").trim();
  } catch {
    return "";
  }
}

function payeeLinesFromMethods(rows: Array<Record<string, unknown>>): PayeeLine[] {
  return parsePayeeLines(
    rows
      .filter(row => row.blocked !== true && row.show_on_receipt === true)
      .map(row => ({
        label: row.receipt_label || row.description || row.code || "Pay",
        number: row.payee_number,
      })),
  );
}

/** Payee numbers saved on Payment Methods. Each company keeps its own. */
async function loadPayeeLines(): Promise<PayeeLine[]> {
  try {
    const { getAllPaymentMethods } = await import("../db/sqlite");
    const local = payeeLinesFromMethods(
      (await getAllPaymentMethods()) as unknown as Array<Record<string, unknown>>,
    );
    if (local.length) return local;
  } catch {
    /* try the API */
  }
  try {
    const { fetchPaymentMethods } = await import("./app.services");
    const remote = await fetchPaymentMethods();
    return payeeLinesFromMethods(remote as unknown as Array<Record<string, unknown>>);
  } catch {
    return [];
  }
}

async function applyCompanyReceiptFields(
  payload: SaleReceiptPayload,
  data: PrintReceiptData,
): Promise<SaleReceiptPayload> {
  const next = { ...payload };
  if (!next.payeeLines?.length) {
    const loaded = data.payeeLines?.length ? data.payeeLines : await loadPayeeLines();
    if (loaded.length) next.payeeLines = loaded;
  }
  if (next.vatEnabled === false) {
    next.vatAmount = undefined;
    next.totalExclVat = undefined;
  } else if (next.vatAmount == null || Number(next.vatAmount) <= 0) {
    const vatOn = next.vatEnabled === true || (await salesVatEnabled());
    if (vatOn) {
      const vat = inclusiveVatShare(next.totalAmount);
      if (vat > 0) {
        next.vatEnabled = true;
        next.vatAmount = vat;
        next.totalExclVat = next.totalAmount - vat;
      }
    }
  }
  return next;
}

function brandingFromCompany(company?: CompanyInfo, branchCode?: string) {
  const logo = company?.logo;
  const name = company?.name || "";
  return {
    name,
    displayName: company?.displayName || name,
    branchCode: branchCode || company?.branchCode || "",
    logo: isPlaceholderCompanyLogo(logo) ? null : logo || null,
    address: company?.address || "",
    phone: company?.phone || "",
    email: company?.email || "",
    tin: company?.tin,
    vatNo: company?.vatNo,
  };
}

export async function buildSaleReceiptDocument(
  data: PrintReceiptData,
  _process: ReceiptProcess,
  printerType: PrinterType,
): Promise<ReceiptDocument> {
  // Sale — Standard is the layout each company saves (Adrace and others).
  // Reprints use that same configuration, not a separate compact slip.
  const resolved =
    (await resolveReceiptTemplate({
      receiptType: "sale",
      deviceType: "desktop",
      printerType: "desktop_silent",
      process: "pos_sale",
    })) ||
    (await resolveReceiptTemplate({
      receiptType: "sale",
      deviceType: "mobile",
      printerType: mapPrinterType(printerType),
      process: "pos_sale",
    }));
  const { template: resolvedTemplate, branding: apiBranding } =
    resolveTemplateFromConfig(resolved, "sale", "standard");
  const template = clampMobilePaperProfile(resolvedTemplate, printerType);
  const branchCode = await loadBranchCode();
  const branding = mergeBranding(
    brandingFromCompany(data.companyInfo, branchCode),
    apiBranding,
  );
  const payload = await applyCompanyReceiptFields(
    mobilePrintDataToSalePayload(data),
    data,
  );
  return buildReceiptDocumentFromTemplate(payload, template, branding);
}

export async function buildKotReceiptDocument(
  data: KotData,
  printerType: PrinterType,
): Promise<ReceiptDocument> {
  const resolved = await resolveReceiptTemplate({
    receiptType: "kot",
    deviceType: "mobile",
    printerType: mapPrinterType(printerType),
    process: "restaurant_kot",
  });
  const { template, branding } = resolveTemplateFromConfig(
    resolved,
    "kot",
    "compact",
  );
  const payload = kotTicketDataToPayload(data, "kot");
  return buildReceiptDocumentFromTemplate(payload, template, branding);
}

function layoutSamplePayload(receiptType: ReceiptType): ReceiptBuildPayload {
  const printedAt = new Date().toISOString();
  if (receiptType === "kot" || receiptType === "bar") {
    return {
      receiptType,
      title: receiptType === "kot" ? "KITCHEN" : "BAR",
      orderNo: "1042",
      tableLabel: "Table 4",
      orderTypeDisplay: "Dine in",
      waiterName: "Amina",
      printedAt,
      items: [
        { item_name: "Chapati", quantity: 2, special_instructions: "No salt" },
        { item_name: "Rolex", quantity: 1 },
      ],
    };
  }
  if (receiptType === "payment_journal") {
    return {
      receiptType,
      documentNo: "PAY-1042",
      documentDate: printedAt,
      lines: [{ item_name: "Customer payment", quantity: 1, total_price: 25000 }],
      totalAmount: 25000,
      paymentMethod: "Cash",
    };
  }
  return {
    receiptType: receiptType === "prepayment" ? "prepayment" : "sale",
    invoiceNo: receiptType === "prepayment" ? "TEST-PREPAY" : "TEST-SALE",
    documentDate: printedAt,
    customerName: "Walk-in",
    sellerName: "Test cashier",
    lines: [
      { item_name: "Chapati", quantity: 2, unit_price: 2000, line_total: 4000 },
      { item_name: "Rolex", quantity: 1, unit_price: 5000, line_total: 5000 },
    ],
    totalAmount: 9000,
    amountReceived: 10000,
    changeAmount: 1000,
    paymentMethod: "Cash",
  };
}

/** Print the layout open on the screen, including changes that are not saved yet. */
export async function buildLayoutSampleDocument(
  template: ResolvedReceiptTemplate,
  printerType: PrinterType,
): Promise<ReceiptDocument> {
  const company = await fetchCompanyInfoForReceipt();
  const branchCode = await loadBranchCode();
  const branding = brandingFromCompany(company, branchCode);
  const fitted = clampMobilePaperProfile(
    {
      ...template,
      paperProfile: template.paperProfile || { widthMm: 58, charsPerLine: 32 },
    },
    printerType,
  );
  const sample = layoutSamplePayload(template.receiptType);
  const payload =
    sample.receiptType === "sale" || sample.receiptType === "prepayment"
      ? await applyCompanyReceiptFields(sample, {
          cartItems: [],
          total: sample.totalAmount,
          username: sample.sellerName || "Test cashier",
          payeeLines: sample.payeeLines,
          vatEnabled: sample.vatEnabled,
          vatAmount: sample.vatAmount,
        })
      : sample;
  return buildReceiptDocumentFromTemplate(payload, fitted, branding);
}
