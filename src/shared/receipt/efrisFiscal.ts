import type {
  ReceiptBuildPayload,
  ReceiptDocumentNode,
  SaleReceiptPayload,
} from "./types";

/** Default URA validation prefix when the fiscal response has no QR payload. */
export const DEFAULT_EFRIS_VALIDATION_PREFIX =
  "https://efristest.ura.go.ug/efrissite/sit/investigation/validation/view?invoiceNo=";

/**
 * Prefer the QR payload from T109; otherwise build the URA validation URL from FDN.
 */
export function resolveEfrisQrPayload(options: {
  qrFromResponse?: string | null;
  fdn?: string | null;
  invoiceDownloadLink?: string | null;
}): string {
  const fromResponse = String(options.qrFromResponse || "").trim();
  if (fromResponse) return fromResponse;
  const fdn = String(options.fdn || "").trim();
  if (!fdn) return "";
  const prefix =
    String(options.invoiceDownloadLink || "").trim() ||
    DEFAULT_EFRIS_VALIDATION_PREFIX;
  if (prefix.includes(fdn)) return prefix;
  return `${prefix}${fdn}`;
}

function nodeBlob(nodes: ReceiptDocumentNode[]): string {
  return nodes
    .map((n) => [n.text, n.left, n.right, n.type].filter(Boolean).join(" "))
    .join("\n");
}

export function hasEfrisFiscalBlock(nodes: ReceiptDocumentNode[]): boolean {
  const blob = nodeBlob(nodes).toLowerCase();
  return (
    nodes.some((n) => n.type === "qr") ||
    blob.includes("fdn:") ||
    blob.includes("verification:")
  );
}

/** QR + FDN + verification lines for thermal compilers. */
export function appendEfrisFiscalNodes(
  nodes: ReceiptDocumentNode[],
  payload: SaleReceiptPayload,
): void {
  const qrText = resolveEfrisQrPayload({
    qrFromResponse: payload.efrisQrCode,
    fdn: payload.efrisFdn,
  });
  if (qrText) {
    nodes.push({
      type: "qr",
      text: qrText,
      maxWidthMm: 32,
      maxHeightMm: 32,
      style: { align: "center" },
    });
  }
  if (payload.efrisFdn) {
    nodes.push({
      type: "text",
      text: `FDN: ${payload.efrisFdn}`,
      style: { align: "center", bold: true },
    });
  }
  if (payload.efrisVerificationCode) {
    nodes.push({
      type: "text",
      text: `Verification: ${payload.efrisVerificationCode}`,
      style: { align: "center" },
    });
  }
}

function isReceiptFooterText(text: string): boolean {
  const t = text.trim();
  return (
    /^thank you/i.test(t) ||
    /^receipt id:/i.test(t) ||
    /zentroapp\.app/i.test(t) ||
    /^powered by zentroapp/i.test(t) ||
    /^contact:/i.test(t)
  );
}

/**
 * Always print EFRIS fiscal fields when present — even if the receipt
 * template omits the qr_code section. Place them before the thank-you
 * footer, matching the desktop sale layout.
 */
export function appendMandatoryEfrisFiscal(
  nodes: ReceiptDocumentNode[],
  payload: ReceiptBuildPayload,
): void {
  if (payload.receiptType !== "sale" && payload.receiptType !== "prepayment") {
    return;
  }
  const sale = payload as SaleReceiptPayload;
  if (!sale.efrisFdn && !sale.efrisQrCode) {
    return;
  }
  if (hasEfrisFiscalBlock(nodes)) {
    return;
  }
  const block: ReceiptDocumentNode[] = [{ type: "rule" }];
  appendEfrisFiscalNodes(block, sale);
  const footerAt = nodes.findIndex((node) =>
    isReceiptFooterText(node.text || ""),
  );
  if (footerAt >= 0) {
    nodes.splice(footerAt, 0, ...block);
    return;
  }
  nodes.push(...block);
}
