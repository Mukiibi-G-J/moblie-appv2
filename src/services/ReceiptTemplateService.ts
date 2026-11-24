import AsyncStorage from "@react-native-async-storage/async-storage";
import {createAxiosInstance} from "../axios/axios";
import type {
  PrintContext,
  ResolvedReceiptConfig,
  ResolvedReceiptTemplate,
  TemplateSection,
} from "../shared/receipt/types";

export type ReceiptTemplateRecord = {
  id: number;
  code: string;
  name: string;
  receipt_type: string;
  layout_preset: string;
  sections: TemplateSection[];
  editor_mode: string;
  is_active: boolean;
  is_system: boolean;
};

function unwrapList(data: unknown): ReceiptTemplateRecord[] {
  if (Array.isArray(data)) {
    return data as ReceiptTemplateRecord[];
  }
  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as {results?: unknown}).results)
  ) {
    return (data as {results: ReceiptTemplateRecord[]}).results;
  }
  return [];
}

async function receiptApi() {
  const tenant = (await AsyncStorage.getItem("tenant")) || undefined;
  return createAxiosInstance(tenant);
}

export async function listReceiptTemplates(
  receiptType: string,
): Promise<ReceiptTemplateRecord[]> {
  const api = await receiptApi();
  const res = await api.get(
    `/api/company/receipt-templates/?receipt_type=${encodeURIComponent(receiptType)}`,
  );
  return unwrapList(res.data).filter(row => row.is_active !== false);
}

export async function saveReceiptTemplateSections(
  id: number,
  sections: TemplateSection[],
): Promise<void> {
  const api = await receiptApi();
  await api.patch(`/api/company/receipt-templates/${id}/`, {
    sections,
    editor_mode: "visual",
  });
  await invalidateReceiptTemplateCache();
}

function normalizeTemplate(raw: Record<string, unknown>): ResolvedReceiptTemplate {
  return {
    id: raw.id as number | undefined,
    code: String(raw.code ?? ""),
    name: String(raw.name ?? ""),
    receiptType: (raw.receipt_type ?? raw.receiptType ?? "sale") as ResolvedReceiptTemplate["receiptType"],
    layoutPreset: (raw.layout_preset ?? raw.layoutPreset ?? "standard") as ResolvedReceiptTemplate["layoutPreset"],
    paperProfile: (raw.paper_profile ?? raw.paperProfile ?? {}) as ResolvedReceiptTemplate["paperProfile"],
    sections: (raw.sections ?? []) as ResolvedReceiptTemplate["sections"],
    editorMode: (raw.editor_mode ?? raw.editorMode ?? "visual") as ResolvedReceiptTemplate["editorMode"],
    formatString: String(raw.format_string ?? raw.formatString ?? ""),
    isSystem: Boolean(raw.is_system ?? raw.isSystem),
    isActive: raw.is_active !== false && raw.isActive !== false,
  };
}

const CACHE_PREFIX = "receipt_template_cache:";
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(ctx: PrintContext): string {
  return [
    CACHE_PREFIX,
    ctx.receiptType,
    ctx.deviceType,
    ctx.printerType,
    ctx.process,
    ctx.branchId ?? "",
  ].join("");
}

export async function resolveReceiptTemplate(
  context: PrintContext,
): Promise<ResolvedReceiptConfig | null> {
  const key = cacheKey(context);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as { at: number; config: ResolvedReceiptConfig };
      if (Date.now() - parsed.at < CACHE_TTL_MS) {
        return parsed.config;
      }
    }
  } catch {
    /* ignore cache read errors */
  }

  const params = new URLSearchParams({
    receipt_type: context.receiptType,
    device_type: context.deviceType,
    printer_type: context.printerType,
    process: context.process,
  });
  if (context.branchId != null) {
    params.set("branch_id", String(context.branchId));
  }

  try {
    const api = await receiptApi();
    const res = await api.get<{
      template: ResolvedReceiptTemplate;
      branding: ResolvedReceiptConfig["branding"];
    }>(`/api/company/receipt-templates/resolve/?${params.toString()}`);
    const config: ResolvedReceiptConfig = {
      template: normalizeTemplate(
        res.data.template as Record<string, unknown>,
      ),
      branding: res.data.branding,
    };
    await AsyncStorage.setItem(
      key,
      JSON.stringify({ at: Date.now(), config }),
    );
    return config;
  } catch {
    return null;
  }
}

export async function invalidateReceiptTemplateCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (toRemove.length) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch {
    /* ignore */
  }
}
