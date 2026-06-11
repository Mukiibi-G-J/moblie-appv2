import { USBPrinter } from "react-native-thermal-receipt-printer";
import { effectiveReceiptCols, padReceiptColumns } from "./formatters";
import type { ReceiptDocument, ReceiptDocumentNode } from "./types";

const LINE = "--------------------------------";
const DEFAULT_COLS = 32;

function wrapCenter(text: string): string {
  return `<C>${text}</C>\n`;
}

function wrapBold(text: string): string {
  return `<B>${text}</B>\n`;
}

function nodeToUsb(node: ReceiptDocumentNode, cols: number): string {
  const style = node.style || {};
  switch (node.type) {
    case "image":
      return "";
    case "text": {
      const t = node.text || "";
      if (style.align === "center") {
        return style.bold ? `<C><B>${t}</B></C>\n` : wrapCenter(t);
      }
      return style.bold ? wrapBold(t) : `${t}\n`;
    }
    case "row":
      return (style.bold ? wrapBold : (s: string) => s + "\n")(
        padReceiptColumns(node.left || "", node.right || "", cols),
      );
    case "rule":
      return `${wrapCenter(LINE)}`;
    case "feed":
      return "\n".repeat(node.lines || 1);
    case "cut":
      return "\n\n\n";
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
  await USBPrinter.printText(text);
}
