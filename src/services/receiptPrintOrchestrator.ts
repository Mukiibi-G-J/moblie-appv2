import { isPlaceholderCompanyLogo } from "../utils/companyLogoUrl";
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
  const sections = (template.sections || []).map((s) => {
    if (s.id === "footer_receipt_id" || s.id === "qr_code") {
      return { ...s, enabled: false };
    }
    if (s.id === "footer_thanks") {
      return { ...s, config: { ...(s.config || {}), compact: true } };
    }
    if (s.id === "footer_marketing") {
      return {
        ...s,
        config: { ...(s.config || {}), lines: ["Powered by Zentroapp"] },
      };
    }
    return s;
  });
  return {
    ...template,
    layoutPreset: "compact",
    sections,
    paperProfile: {
      ...template.paperProfile,
      widthMm,
      charsPerLine: Math.min(chars, maxCols),
      logoWidthPx: Math.min(template.paperProfile?.logoWidthPx ?? 96, 96),
    },
  };
}

function brandingFromCompany(company?: CompanyInfo) {
  const logo = company?.logo;
  const name = company?.name || "";
  return {
    name,
    displayName: company?.displayName || name,
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
  process: ReceiptProcess,
  printerType: PrinterType,
): Promise<ReceiptDocument> {
  const resolved = await resolveReceiptTemplate({
    receiptType: "sale",
    deviceType: "mobile",
    printerType: mapPrinterType(printerType),
    process,
  });
  const layout = "compact";
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
