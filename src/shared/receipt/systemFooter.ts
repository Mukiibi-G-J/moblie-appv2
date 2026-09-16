import type {
  ReceiptBuildPayload,
  ReceiptDocumentNode,
} from "./types";

/** Zentro branding — appended to every receipt when not already present. */
export const SYSTEM_MARKETING_LINES = [
  "www.zentroapp.app",
  "Contact: 0750440865 / 0779899789",
  "Powered by Zentroapp",
] as const;

function nodeText(nodes: ReceiptDocumentNode[]): string {
  return nodes
    .map((n) => [n.text, n.left, n.right].filter(Boolean).join(" "))
    .join("\n");
}

export function hasSystemMarketingBlock(nodes: ReceiptDocumentNode[]): boolean {
  const blob = nodeText(nodes).toLowerCase();
  return (
    blob.includes("zentroapp.app") || blob.includes("powered by zentroapp")
  );
}

export function hasCustomerThanksBlock(nodes: ReceiptDocumentNode[]): boolean {
  const blob = nodeText(nodes).toLowerCase();
  return (
    blob.includes("thank you for your purchase") ||
    blob.includes("please come again") ||
    blob.includes("thank you")
  );
}

/** Customer-facing receipts: thanks + short branding. */
export function appendMandatorySystemFooter(
  nodes: ReceiptDocumentNode[],
  payload: ReceiptBuildPayload,
): void {
  const customerFacing =
    payload.receiptType === "sale" ||
    payload.receiptType === "prepayment" ||
    payload.receiptType === "payment_journal";

  if (customerFacing && !hasCustomerThanksBlock(nodes)) {
    nodes.push({
      type: "text",
      text: "THANK YOU",
      style: { align: "center" },
    });
  }

  if (!hasSystemMarketingBlock(nodes)) {
    nodes.push({
      type: "text",
      text: "Powered by Zentroapp",
      style: { align: "center" },
    });
  }
}
