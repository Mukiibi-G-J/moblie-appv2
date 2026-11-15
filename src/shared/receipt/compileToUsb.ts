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
      // The print head sits above the tear edge. These feeds bring the
      // website and contact lines out before the paper is torn.
      return "\n\n\n\n\n";
    default:
      return "";
  }
}

export type UsbReceiptPiece =
  | { kind: "text"; text: string }
  | { kind: "qr"; data: string };

export function compileDocumentToUsbPieces(
  document: ReceiptDocument,
): UsbReceiptPiece[] {
  const cols = effectiveReceiptCols(
    document.paperProfile?.charsPerLine ?? DEFAULT_COLS,
    document.paperProfile?.widthMm ?? 58,
  );
  const pieces: UsbReceiptPiece[] = [];
  let buf = "";
  const flush = () => {
    if (!buf) return;
    pieces.push({ kind: "text", text: buf });
    buf = "";
  };
  for (const node of document.nodes) {
    if (node.type === "qr") {
      flush();
      const data = String(node.text || "").trim();
      if (data) pieces.push({ kind: "qr", data });
      continue;
    }
    buf += nodeToUsb(node, cols);
  }
  flush();
  return pieces;
}

export function compileDocumentToUsbText(document: ReceiptDocument): string {
  return compileDocumentToUsbPieces(document)
    .filter((piece): piece is { kind: "text"; text: string } => piece.kind === "text")
    .map((piece) => piece.text)
    .join("");
}

export async function printUsbDocument(document: ReceiptDocument): Promise<void> {
  const text = compileDocumentToUsbText(document);
  // XP-58IIT is tear-bar: extra tailingLine/cut feeds waste paper.
  await USBPrinter.printText(text, {tailingLine: false, cut: false});
}
