import { effectiveReceiptCols, padReceiptColumns } from "./formatters";
import type { ReceiptDocument, ReceiptDocumentNode } from "./types";

type EscPosTextStyle = {
  align?: "left" | "center" | "right";
  bold?: boolean;
  double?: boolean;
};

function encodeEscPosText(text: string): number[] {
  if (typeof TextEncoder !== "undefined") {
    return Array.from(new TextEncoder().encode(text));
  }
  return Array.from(text).map((char) => char.charCodeAt(0) & 0xff);
}

function appendEscPosInit(bytes: number[]): void {
  bytes.push(0x1b, 0x40);
}

function appendEscPosText(
  bytes: number[],
  text: string,
  style: EscPosTextStyle = {},
): void {
  if (style.align === "center") {
    bytes.push(0x1b, 0x61, 1);
  } else if (style.align === "right") {
    bytes.push(0x1b, 0x61, 2);
  } else {
    bytes.push(0x1b, 0x61, 0);
  }
  if (style.double) {
    bytes.push(0x1d, 0x21, 0x11);
  }
  if (style.bold) {
    bytes.push(0x1b, 0x45, 1);
  }
  bytes.push(...encodeEscPosText(String(text)), 0x0a);
  bytes.push(0x1b, 0x45, 0);
  bytes.push(0x1d, 0x21, 0x00);
  bytes.push(0x1b, 0x61, 0);
}

function appendNode(bytes: number[], node: ReceiptDocumentNode, cols: number): void {
  const style = node.style || {};
  switch (node.type) {
    case "text":
      appendEscPosText(bytes, node.text || "", style);
      break;
    case "row": {
      const line = padReceiptColumns(node.left || "", node.right || "", cols);
      appendEscPosText(bytes, line, { bold: style.bold });
      break;
    }
    case "rule":
      appendEscPosText(bytes, "-".repeat(Math.min(cols, 32)));
      break;
    case "feed":
      for (let i = 0; i < (node.lines || 1); i++) {
        bytes.push(0x0a);
      }
      break;
    case "cut":
      bytes.push(0x1d, 0x56, 0x00);
      break;
    default:
      break;
  }
}

/** ESC/POS bytes for Bluetooth raw print (logo printed separately). */
export function compileDocumentToEscPosBytes(
  document: ReceiptDocument,
  skipImage = true,
): number[] {
  const cols = effectiveReceiptCols(
    document.paperProfile?.charsPerLine ?? 32,
    document.paperProfile?.widthMm ?? 58,
  );
  const bytes: number[] = [];
  appendEscPosInit(bytes);
  for (const node of document.nodes) {
    if (skipImage && node.type === "image") {
      continue;
    }
    appendNode(bytes, node, cols);
  }
  return bytes.map((b) => b & 0xff);
}

/** Minimal ESC/POS slip to verify printer connectivity (saves paper). */
export function buildShortTestEscPosBytes(deviceName?: string): number[] {
  const bytes: number[] = [];
  appendEscPosInit(bytes);
  appendEscPosText(bytes, "ZENTRO APP - TEST", {
    align: "center",
    bold: true,
    double: true,
  });
  appendEscPosText(bytes, "Printer test OK", { align: "center", bold: true });
  appendEscPosText(bytes, `Date: ${new Date().toLocaleString()}`, {
    align: "center",
  });
  if (deviceName) {
    appendEscPosText(bytes, `Device: ${deviceName}`, { align: "center" });
  }
  appendEscPosText(bytes, "-".repeat(32), { align: "center" });
  bytes.push(0x1d, 0x56, 0x00);
  return bytes.map((b) => b & 0xff);
}
