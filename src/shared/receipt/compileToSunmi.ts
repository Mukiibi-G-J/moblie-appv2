import PrinterSunmi from "react-native-printer-sunmi";
import {
  prepareCompanyLogoForPrint,
  fitReceiptLogoSize,
} from "../../utils/companyLogoUrl";
import { effectiveReceiptCols, padReceiptColumns } from "./formatters";
import type { ReceiptDocument, ReceiptDocumentNode } from "./types";

function sunmiAlign(align?: string): "LEFT" | "CENTER" | "RIGHT" {
  if (align === "center") return "CENTER";
  if (align === "right") return "RIGHT";
  return "LEFT";
}

function printTextNode(node: ReceiptDocumentNode, textSize: number): void {
  const style = node.style || {};
  PrinterSunmi.initLine({ align: sunmiAlign(style.align) });
  PrinterSunmi.printText(node.text || "", {
    textSize: style.double ? textSize + 4 : textSize,
    bold: Boolean(style.bold && !style.double),
  });
}

function printRowNode(
  node: ReceiptDocumentNode,
  cols: number,
  textSize: number,
): void {
  const line = padReceiptColumns(node.left || "", node.right || "", cols);
  PrinterSunmi.initLine({ align: "LEFT" });
  PrinterSunmi.printText(line, { textSize, bold: false });
}

export async function printSunmiDocument(document: ReceiptDocument): Promise<void> {
  const cols = effectiveReceiptCols(
    document.paperProfile?.charsPerLine ?? 32,
    document.paperProfile?.widthMm ?? 58,
  );
  const maxLogoW = document.paperProfile?.logoWidthPx ?? undefined;
  const textSize = (document.paperProfile?.widthMm ?? 58) <= 58 ? 16 : 22;

  for (const node of document.nodes) {
    switch (node.type) {
      case "image":
        if (node.src) {
          const prepared = await prepareCompanyLogoForPrint(node.src);
          if (prepared) {
            const path = prepared.localPath.startsWith("file://")
              ? prepared.localPath
              : `file://${prepared.localPath}`;
            const { width, height } = fitReceiptLogoSize(
              prepared.width,
              prepared.height,
              maxLogoW,
            );
            PrinterSunmi.initLine({ align: "CENTER" });
            PrinterSunmi.printBitmap(path, {
              width,
              height,
              align: "CENTER",
            });
            PrinterSunmi.printDividingLine("EMPTY", 1);
          }
        }
        break;
      case "text":
        printTextNode(node, textSize);
        break;
      case "row":
        printRowNode(node, cols, textSize);
        break;
      case "rule":
        PrinterSunmi.printDividingLine("SOLID", 1);
        break;
      case "feed":
        PrinterSunmi.addText("\n".repeat(node.lines || 1));
        break;
      case "cut":
        break;
      default:
        break;
    }
  }

  PrinterSunmi.addText("\n");
  PrinterSunmi.printTrans();
}
