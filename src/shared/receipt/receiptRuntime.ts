import {
  buildReceiptDocument,
  mobilePrintDataToSalePayload,
  receiptDataToSalePayload,
} from "./buildDocument";
import { getFallbackTemplate } from "./fallbackTemplates";
import type {
  KotBarPayload,
  PrintContext,
  ReceiptBranding,
  ReceiptBuildPayload,
  ResolvedReceiptConfig,
  ResolvedReceiptTemplate,
} from "./types";

export function mergeBranding(
  dataBranding: Partial<ReceiptBranding>,
  apiBranding?: ReceiptBranding | null,
): ReceiptBranding {
  return {
    name: dataBranding.name || apiBranding?.name || "",
    displayName: dataBranding.displayName || apiBranding?.displayName,
    branchCode: dataBranding.branchCode || apiBranding?.branchCode,
    logo: dataBranding.logo ?? apiBranding?.logo ?? null,
    address: dataBranding.address || apiBranding?.address || "",
    phone: dataBranding.phone || apiBranding?.phone || "",
    email: dataBranding.email || apiBranding?.email || "",
    tin: dataBranding.tin || apiBranding?.tin,
    vatNo: dataBranding.vatNo || apiBranding?.vatNo,
  };
}

export function resolveTemplateFromConfig(
  resolved: ResolvedReceiptConfig | null,
  receiptType: PrintContext["receiptType"],
  layoutFallback: "compact" | "standard" = "standard",
): { template: ResolvedReceiptTemplate; branding: ReceiptBranding } {
  if (resolved?.template) {
    return {
      template: resolved.template,
      branding: resolved.branding || { name: "" },
    };
  }
  return {
    template: getFallbackTemplate(receiptType, layoutFallback),
    branding: resolved?.branding || { name: "" },
  };
}

export function buildReceiptDocumentFromTemplate(
  payload: ReceiptBuildPayload,
  template: ResolvedReceiptTemplate,
  branding: ReceiptBranding,
) {
  return buildReceiptDocument(payload, template, branding);
}

export function kotTicketDataToPayload(
  data: {
    order_no: string;
    table_label: string;
    order_type_display: string;
    waiter_name?: string;
    printed_at: string;
    items: Array<{
      item_name: string;
      quantity: number | string;
      special_instructions?: string | null;
      fire_state_display?: string | null;
      seat_no?: number | null;
    }>;
    title?: string;
  },
  receiptType: "kot" | "bar",
): KotBarPayload {
  return {
    receiptType,
    title: data.title,
    orderNo: data.order_no,
    tableLabel: data.table_label,
    orderTypeDisplay: data.order_type_display,
    waiterName: data.waiter_name,
    printedAt: data.printed_at,
    items: data.items.map((i) => ({
      item_name: i.item_name,
      quantity: i.quantity,
      special_instructions: i.special_instructions,
      fire_state_display: i.fire_state_display,
      seat_no: i.seat_no,
    })),
  };
}

export { mobilePrintDataToSalePayload, receiptDataToSalePayload };
