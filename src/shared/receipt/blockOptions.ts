import type { PayeeLine, ReceiptBranding, ReceiptDocumentNode } from "./types";

export type { PayeeLine };

export function sectionFlag(
  config: Record<string, unknown> | undefined,
  key: string,
  whenMissing = true,
): boolean {
  if (!config || config[key] === undefined || config[key] === null) {
    return whenMissing;
  }
  const value = config[key];
  if (value === false || value === 0 || value === "false" || value === "0") {
    return false;
  }
  return Boolean(value);
}

export function parsePayeeLines(raw: unknown): PayeeLine[] {
  if (!Array.isArray(raw)) return [];
  const lines: PayeeLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const number = String(
      record.number ?? record.payee_number ?? record.payeeNumber ?? "",
    ).trim();
    if (!number) continue;
    const label =
      String(
        record.label ?? record.receipt_label ?? record.receiptLabel ?? "Pay",
      ).trim() || "Pay";
    lines.push({ label, number });
  }
  return lines;
}

export function appendHowToPayNodes(
  nodes: ReceiptDocumentNode[],
  branding: ReceiptBranding,
  lines: PayeeLine[] | undefined,
): void {
  const payees = (lines || []).filter((line) => line.number.trim());
  if (!payees.length) return;
  const name = (branding.displayName || branding.name || "").trim();
  nodes.push({ type: "rule" });
  if (name) {
    nodes.push({
      type: "text",
      text: `Pay to: ${name}`,
      style: { align: "center", bold: true },
    });
  }
  for (const line of payees) {
    nodes.push({
      type: "row",
      left: line.label || "Pay",
      right: line.number,
    });
  }
}

/** Second thank-you line. Missing config keeps the historical default. */
export function thanksSecondLine(
  config: Record<string, unknown> | undefined,
  whenMissing: string,
): string {
  if (!config || config.secondLine === undefined || config.secondLine === null) {
    return whenMissing;
  }
  return String(config.secondLine).trim();
}
