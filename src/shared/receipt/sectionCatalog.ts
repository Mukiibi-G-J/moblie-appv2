import type { ReceiptType, TemplateSection } from "./types";

export type SectionOptionField = {
  key: string;
  label: string;
  kind: "boolean" | "text";
  defaultValue: boolean | string;
};

export type SectionCatalogEntry = {
  id: string;
  label: string;
  description?: string;
  defaultConfig?: Record<string, unknown>;
  options?: SectionOptionField[];
};

const COMPANY_OPTIONS: SectionOptionField[] = [
  { key: "showAddress", label: "Address", kind: "boolean", defaultValue: true },
  { key: "showPhone", label: "Phone", kind: "boolean", defaultValue: true },
  { key: "showEmail", label: "Email", kind: "boolean", defaultValue: false },
  { key: "showTin", label: "TIN", kind: "boolean", defaultValue: false },
  { key: "showVat", label: "VAT number", kind: "boolean", defaultValue: true },
];

const COMPANY_CONFIG = {
  showAddress: true,
  showPhone: true,
  showEmail: false,
  showTin: false,
  showVat: true,
};

const META_OPTIONS: SectionOptionField[] = [
  { key: "showDocumentNo", label: "Number", kind: "boolean", defaultValue: true },
  { key: "showDateTime", label: "Date and time", kind: "boolean", defaultValue: true },
  { key: "showCashier", label: "Cashier or server", kind: "boolean", defaultValue: true },
];

const META_CONFIG = {
  showDocumentNo: true,
  showDateTime: true,
  showCashier: true,
};

const THANKS_OPTIONS: SectionOptionField[] = [
  { key: "text", label: "Message", kind: "text", defaultValue: "Thank you for your purchase!" },
  { key: "secondLine", label: "Second line", kind: "text", defaultValue: "Please come again" },
];

const LOGO_SECTION: SectionCatalogEntry = {
  id: "logo",
  label: "Company logo",
  description: "Larger logo uses more of the paper width and height.",
  options: [
    { key: "large", label: "Larger logo", kind: "boolean", defaultValue: false },
  ],
};

const LARGE_LOGO_SECTION: SectionCatalogEntry = {
  ...LOGO_SECTION,
  defaultConfig: { large: true },
};

const HOW_TO_PAY: SectionCatalogEntry = {
  id: "how_to_pay",
  label: "How to pay",
  description: "MoMo, Airtel, and other payee numbers from Payment Methods.",
};

const SALE_SECTIONS: SectionCatalogEntry[] = [
  LOGO_SECTION,
  { id: "title", label: "Receipt title", defaultConfig: { text: "SALES RECEIPT" } },
  {
    id: "company_block",
    label: "Company",
    defaultConfig: COMPANY_CONFIG,
    options: COMPANY_OPTIONS,
  },
  { id: "branch_line", label: "Branch name" },
  {
    id: "receipt_meta",
    label: "Sale details",
    defaultConfig: META_CONFIG,
    options: META_OPTIONS,
  },
  { id: "customer_line", label: "Customer" },
  { id: "line_items", label: "Line items (detailed)" },
  { id: "line_items_compact", label: "Line items (compact)" },
  { id: "totals", label: "Totals" },
  { id: "vat_breakdown", label: "VAT breakdown" },
  { id: "tender_change", label: "Tender & change" },
  { id: "payment_method", label: "Payment method" },
  HOW_TO_PAY,
  {
    id: "footer_thanks",
    label: "Thank you",
    defaultConfig: { text: "Thank you for your purchase!", secondLine: "Please come again" },
    options: THANKS_OPTIONS,
  },
  {
    id: "footer_marketing",
    label: "Marketing footer",
    defaultConfig: {
      lines: [
        "www.zentroapp.app",
        "Contact: 0750440865 / 0779899789",
        "Powered by Zentroapp",
      ],
    },
  },
  { id: "footer_receipt_id", label: "Receipt ID footer" },
  { id: "qr_code", label: "QR code" },
];

const PREPAYMENT_SECTIONS: SectionCatalogEntry[] = [
  LOGO_SECTION,
  { id: "title", label: "Title", defaultConfig: { text: "PAYMENT RECEIPT" } },
  {
    id: "company_block",
    label: "Company",
    defaultConfig: COMPANY_CONFIG,
    options: COMPANY_OPTIONS,
  },
  {
    id: "receipt_meta",
    label: "Payment details",
    defaultConfig: { ...META_CONFIG, variant: "prepayment" },
    options: META_OPTIONS,
  },
  { id: "customer_line", label: "Customer", defaultConfig: { variant: "prepayment" } },
  { id: "line_items_compact", label: "Line items" },
  { id: "totals", label: "Totals", defaultConfig: { variant: "prepayment" } },
  { id: "payment_method", label: "Payment method", defaultConfig: { variant: "prepayment" } },
  HOW_TO_PAY,
  {
    id: "footer_thanks",
    label: "Thank you",
    defaultConfig: { text: "Thank you for your purchase!", secondLine: "Please come again" },
    options: THANKS_OPTIONS,
  },
];

const KOT_SECTIONS: SectionCatalogEntry[] = [
  LARGE_LOGO_SECTION,
  { id: "title", label: "Title", defaultConfig: { text: "KITCHEN ORDER" } },
  {
    id: "order_meta",
    label: "Order details",
    defaultConfig: META_CONFIG,
    options: META_OPTIONS,
  },
  { id: "items", label: "Items" },
  { id: "special_instructions", label: "Special instructions" },
  { id: "kitchen_copy_label", label: "Kitchen copy label", defaultConfig: { text: "*** KITCHEN COPY ***" } },
];

const BAR_SECTIONS: SectionCatalogEntry[] = [
  LARGE_LOGO_SECTION,
  { id: "title", label: "Title", defaultConfig: { text: "BAR ORDER" } },
  {
    id: "order_meta",
    label: "Order details",
    defaultConfig: META_CONFIG,
    options: META_OPTIONS,
  },
  { id: "items", label: "Items" },
  { id: "kitchen_copy_label", label: "Bar copy label", defaultConfig: { text: "*** BAR COPY ***" } },
];

const PAYMENT_JOURNAL_SECTIONS: SectionCatalogEntry[] = [
  LARGE_LOGO_SECTION,
  { id: "title", label: "Title", defaultConfig: { text: "PAYMENT RECEIPT" } },
  {
    id: "company_block",
    label: "Company",
    defaultConfig: COMPANY_CONFIG,
    options: COMPANY_OPTIONS,
  },
  {
    id: "receipt_meta",
    label: "Document details",
    defaultConfig: META_CONFIG,
    options: META_OPTIONS,
  },
  { id: "line_items", label: "Line items" },
  { id: "totals", label: "Totals" },
  { id: "payment_method", label: "Payment method" },
  HOW_TO_PAY,
  {
    id: "footer_thanks",
    label: "Thank you",
    defaultConfig: { text: "THANK YOU", secondLine: "" },
    options: THANKS_OPTIONS,
  },
];

export const SECTION_CATALOG: Record<ReceiptType, SectionCatalogEntry[]> = {
  sale: SALE_SECTIONS,
  prepayment: PREPAYMENT_SECTIONS,
  kot: KOT_SECTIONS,
  bar: BAR_SECTIONS,
  payment_journal: PAYMENT_JOURNAL_SECTIONS,
};

export function sectionLabel(receiptType: ReceiptType, sectionId: string): string {
  return SECTION_CATALOG[receiptType]?.find((s) => s.id === sectionId)?.label ?? sectionId;
}

export function nextSectionOrder(sections: TemplateSection[]): number {
  if (!sections.length) return 10;
  return Math.max(...sections.map((s) => s.order ?? 0)) + 10;
}

export function createSectionFromCatalog(
  receiptType: ReceiptType,
  sectionId: string,
  order: number,
): TemplateSection | null {
  const entry = SECTION_CATALOG[receiptType]?.find((s) => s.id === sectionId);
  if (!entry) return null;
  return {
    id: entry.id,
    enabled: true,
    order,
    config: entry.defaultConfig ? { ...entry.defaultConfig } : {},
  };
}
