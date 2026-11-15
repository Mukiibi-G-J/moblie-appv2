export type PostedReceiptFiscal = {
  efrisFdn?: string;
  efrisVerificationCode?: string;
  efrisQrCode?: string;
  /** True when the invoice payload included total_vat_amount. */
  vatKnown: boolean;
  /** Posted VAT. 0 means this sale has no VAT line. */
  vatAmount: number;
};

export type ReceiptFiscalPrintFields = {
  efrisFdn?: string;
  efrisVerificationCode?: string;
  efrisQrCode?: string;
  vatEnabled?: boolean;
  vatAmount?: number;
  totalExclVat?: number;
};

function asRecord(source: unknown): Record<string, unknown> {
  return source && typeof source === "object"
    ? (source as Record<string, unknown>)
    : {};
}

export function fiscalFromInvoice(source: unknown): PostedReceiptFiscal {
  const rec = asRecord(source);
  const nested = asRecord(rec.efris);
  const fdn = String(nested.fdn || rec.efris_fdn || "").trim();
  const verification = String(
    nested.verification_code || rec.efris_verification_code || "",
  ).trim();
  const qr = String(nested.qr_code || rec.efris_qr_code || "").trim();
  const vatRaw = rec.total_vat_amount;
  const vat = Number(vatRaw);
  const vatKnown = vatRaw != null && vatRaw !== "" && Number.isFinite(vat);
  return {
    ...(fdn ? {efrisFdn: fdn} : {}),
    ...(verification ? {efrisVerificationCode: verification} : {}),
    ...(qr ? {efrisQrCode: qr} : {}),
    vatKnown,
    vatAmount: vatKnown && vat > 0 ? vat : 0,
  };
}

export function receiptFieldsFromFiscal(
  fiscal: PostedReceiptFiscal | null,
  total?: number,
): ReceiptFiscalPrintFields {
  if (!fiscal) {
    return {};
  }
  const fields: ReceiptFiscalPrintFields = {
    efrisFdn: fiscal.efrisFdn,
    efrisVerificationCode: fiscal.efrisVerificationCode,
    efrisQrCode: fiscal.efrisQrCode,
  };
  if (!fiscal.vatKnown) {
    return fields;
  }
  if (fiscal.vatAmount > 0) {
    return {
      ...fields,
      vatEnabled: true,
      vatAmount: fiscal.vatAmount,
      totalExclVat:
        total != null && Number.isFinite(total)
          ? total - fiscal.vatAmount
          : undefined,
    };
  }
  return {...fields, vatEnabled: false};
}

/** Load FDN / QR / VAT after post. Fiscalization finishes before this GET. */
export async function loadPostedReceiptFiscal(
  invoiceId: number | string | null | undefined,
  invoiceNo?: string,
): Promise<PostedReceiptFiscal | null> {
  if (invoiceId == null || invoiceId === "") {
    return null;
  }
  try {
    const {getSalesInvoice} = await import("./app.services");
    const full = await getSalesInvoice(
      invoiceId,
      invoiceNo ? {invoiceNo} : undefined,
    );
    return fiscalFromInvoice(full);
  } catch {
    return null;
  }
}

export function invoiceIdFromPostedPayload(invoice: unknown): number | string | undefined {
  const rec = asRecord(invoice);
  const id = rec.id ?? rec.pk;
  if (typeof id === "number" && Number.isFinite(id)) {
    return id;
  }
  if (typeof id === "string" && id.trim()) {
    return id.trim();
  }
  return undefined;
}
