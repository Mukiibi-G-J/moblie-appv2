import type { KotData } from "./UsbPrinterService";
import type { CompanyInfo, PrintReceiptData, PrinterType } from "./PrintService";
import { resolveReceiptTemplate } from "./ReceiptTemplateService";
import {
  buildReceiptDocumentFromTemplate,
  kotTicketDataToPayload,
  mergeBranding,
  mobilePrintDataToSalePayload,
  resolveTemplateFromConfig,
} from "../shared/receipt/receiptRuntime";
import type {
  ReceiptDocument,
  ReceiptProcess,
  PrinterType as ApiPrinterType,
  ResolvedReceiptTemplate,
} from "../shared/receipt/types";

function mapPrinterType(printer: PrinterType): ApiPrinterType {
  if (printer === "sunmi") return "sunmi";
  if (printer === "usb") return "usb";
  return "bluetooth";
}

/** 58mm mobile printers fit ~32 chars; DB templates may use 42 from web. */
function clampMobilePaperProfile(
  template: ResolvedReceiptTemplate,
  printerType: PrinterType,
): ResolvedReceiptTemplate {
  if (printerType !== "bluetooth" && printerType !== "usb" && printerType !== "sunmi") {
    return template;
  }
  const widthMm = template.paperProfile?.widthMm ?? 58;
  const maxCols = widthMm <= 58 ? 32 : 42;
  const chars = template.paperProfile?.charsPerLine ?? maxCols;
  return {
    ...template,
    paperProfile: {
      ...template.paperProfile,
      widthMm,
      charsPerLine: Math.min(chars, maxCols),
    },
  };
}

function brandingFromCompany(company?: CompanyInfo) {
  return {
    name: company?.name || "",
    logo: company?.logo ?? null,
    address: company?.address || "",
    phone: company?.phone || "",
    email: company?.email || "",
    tin: company?.tin,
    vatNo: company?.vatNo,
  };
}

export async function buildSaleReceiptDocument(
  data: PrintReceiptData,
  process: ReceiptProcess,
  printerType: PrinterType,
): Promise<ReceiptDocument> {
  const resolved = await resolveReceiptTemplate({
    receiptType: "sale",
    deviceType: "mobile",
    printerType: mapPrinterType(printerType),
    process,
  });
  const layout =
    data.compactReceipt || process === "sales_history_reprint"
      ? "compact"
      : "standard";
  const { template: resolvedTemplate, branding: apiBranding } =
    resolveTemplateFromConfig(resolved, "sale", layout);
  const template = clampMobilePaperProfile(resolvedTemplate, printerType);
  const branding = mergeBranding(brandingFromCompany(data.companyInfo), apiBranding);
  const payload = mobilePrintDataToSalePayload(data);
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
