import { USBPrinter } from "react-native-thermal-receipt-printer";
import { effectiveReceiptCols, padReceiptColumns } from "./formatters";
import type { ReceiptDocument, ReceiptDocumentNode } from "./types";

const LINE = "--------------------------------";
const DEFAULT_COLS = 32;

function wrapCenter(text: string): string {
  return `<C>${text}</C>\n`;
}

function nodeToUsb(node: ReceiptDocumentNode, cols: number): string {
  const style = node.style || {};
  switch (node.type) {
    case "image":
      return "";
    case "text": {
      const t = node.text || "";
      // XP-58IIT maps <B> to double-width/height, which wraps the company name.
      if (style.align === "center") {
        return wrapCenter(t);
      }
      return `${t}\n`;
    }
    case "row":
      return `${padReceiptColumns(node.left || "", node.right || "", cols)}\n`;
    case "rule":
      // Full-width dashes; do not wrap in <C> (extra feed on XP-58IIT).
      return `${LINE}\n`;
    case "feed":
      return "\n".repeat(Math.min(1, Math.max(0, node.lines || 1)));
    case "cut":
      // Tear-bar printers: a trailing newline after the last line wastes paper.
      return "";
    default:
      return "";
  }
}

export function compileDocumentToUsbText(document: ReceiptDocument): string {
  const cols = effectiveReceiptCols(
    document.paperProfile?.charsPerLine ?? DEFAULT_COLS,
    document.paperProfile?.widthMm ?? 58,
  );
  return document.nodes.map((n) => nodeToUsb(n, cols)).join("");
}

export async function printUsbDocument(document: ReceiptDocument): Promise<void> {
  const text = compileDocumentToUsbText(document);
  // XP-58IIT is tear-bar: extra tailingLine/cut feeds waste paper.
  await USBPrinter.printText(text, {tailingLine: false, cut: false});
}
