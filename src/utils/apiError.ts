/**
 * Turn Django / DRF / axios errors into a short message the user can read.
 * Callers often receive a bare string because axios unwraps `{ detail: ... }`.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cleanMessage(message: string): string {
  let text = message.trim();
  const wrapped = text.match(/^\(\s*(['"])([\s\S]*?)\1\s*(?:,[\s\S]*)?\)$/);
  if (wrapped?.[2]) {
    text = wrapped[2];
  }
  return text.replace(/^["']+|["']+$/g, '').trim();
}

/** Pull the human text out of ErrorDetail(string='...', code='unique'). */
function extractErrorDetailMessage(raw: string): string | null {
  const match = raw.match(/ErrorDetail\(\s*string\s*=\s*(['"])(.*?)\1/s);
  const inner = match?.[2]?.trim();
  return inner ? cleanMessage(inner) : null;
}

function looksTechnical(raw: string): boolean {
  const trimmed = raw.trim();
  return (
    trimmed.includes('ErrorDetail') ||
    trimmed.includes('Traceback') ||
    (trimmed.startsWith('{') && trimmed.includes(':')) ||
    (trimmed.startsWith('<') && trimmed.includes('</'))
  );
}

function parseNestedPayload(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    // Python dict repr, e.g. {'item_name': ['...']}
    const asJson = trimmed
      .replace(/\bNone\b/g, 'null')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/'/g, '"');
    try {
      return JSON.parse(asJson);
    } catch {
      return null;
    }
  }
}

function collectMessages(
  value: unknown,
  preferredField?: string,
  into: string[] = [],
  seen = new Set<string>(),
): string[] {
  const push = (message: string | null | undefined) => {
    const cleaned = message ? cleanMessage(message) : '';
    if (!cleaned || looksTechnical(cleaned) || seen.has(cleaned)) {
      return;
    }
    seen.add(cleaned);
    into.push(cleaned);
  };

  if (value == null) {
    return into;
  }

  if (typeof value === 'string') {
    const fromDetail = extractErrorDetailMessage(value);
    if (fromDetail) {
      push(fromDetail);
      return into;
    }
    if (isProtectedDeleteMessage(value)) {
      push(cleanMessage(value) || value);
      return into;
    }
    const nested = parseNestedPayload(value);
    if (nested != null) {
      return collectMessages(nested, preferredField, into, seen);
    }
    push(value);
    return into;
  }

  if (Array.isArray(value)) {
    value.forEach(item => collectMessages(item, preferredField, into, seen));
    return into;
  }

  if (!isRecord(value)) {
    push(String(value));
    return into;
  }

  if (preferredField && value[preferredField] != null) {
    collectMessages(value[preferredField], preferredField, into, seen);
    if (into.length) {
      return into;
    }
  }

  if (preferredField && isRecord(value.errors) && value.errors[preferredField] != null) {
    collectMessages(value.errors[preferredField], preferredField, into, seen);
    if (into.length) {
      return into;
    }
  }

  for (const key of ['detail', 'error', 'message', 'non_field_errors'] as const) {
    if (value[key] != null) {
      collectMessages(value[key], preferredField, into, seen);
      if (into.length) {
        return into;
      }
    }
  }

  if (isRecord(value.errors)) {
    collectMessages(value.errors, preferredField, into, seen);
    if (into.length) {
      return into;
    }
  }

  for (const [key, nested] of Object.entries(value)) {
    if (
      key === 'status' ||
      key === 'code' ||
      key === 'detail' ||
      key === 'error' ||
      key === 'message' ||
      key === 'errors'
    ) {
      continue;
    }
    collectMessages(nested, preferredField, into, seen);
    if (into.length) {
      return into;
    }
  }

  return into;
}

function isDuplicateMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('already exists') ||
    lower.includes('must be unique') ||
    lower.includes('duplicate')
  );
}

function isProtectedDeleteMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('cannot delete') ||
    lower.includes('protected foreign') ||
    lower.includes('referenced through protected') ||
    lower.includes('protectederror')
  );
}

function humanizeMessage(
  message: string,
  field?: string,
  itemName?: string,
): string {
  const lower = message.toLowerCase();
  const name = itemName?.trim();
  const itemLabel = name ? `"${name}"` : 'This item';

  if (isProtectedDeleteMessage(message)) {
    if (lower.includes('unit of measure')) {
      return 'This item must keep at least one unit of measure.';
    }
    return (
      `${itemLabel} cannot be deleted because it already has stock or sales/purchase history. ` +
      'Keep the item and adjust the quantity instead.'
    );
  }

  if (!isDuplicateMessage(message)) {
    return message;
  }
  if (
    field === 'item_name' ||
    field === 'name' ||
    /item[_\s-]?name/i.test(message)
  ) {
    return name
      ? `An item named "${name}" already exists. Please use a different name.`
      : 'An item with this name already exists. Please use a different name.';
  }
  if (field === 'bar_code_no' || /bar\s*code/i.test(message)) {
    return 'An item with this barcode already exists. Please use a different barcode.';
  }
  return message;
}

export function getApiErrorMessage(
  error: unknown,
  options?: {
    field?: string;
    fallback?: string;
    itemName?: string;
  },
): string {
  const fallback =
    options?.fallback || 'Something went wrong. Please try again.';
  const field = options?.field;
  const itemName = options?.itemName;

  const finish = (message: string) =>
    humanizeMessage(message, field, itemName);

  if (typeof error === 'string' && error.trim()) {
    const messages = collectMessages(error, field);
    if (messages[0]) {
      return finish(messages[0]);
    }
    const fromDetail = extractErrorDetailMessage(error);
    if (fromDetail) {
      return finish(fromDetail);
    }
    if (isProtectedDeleteMessage(error)) {
      return finish(error);
    }
  }

  const err = error as {
    response?: {data?: unknown};
    customMessage?: string;
    message?: string;
    detail?: unknown;
  };

  if (typeof err?.customMessage === 'string' && err.customMessage.trim()) {
    return finish(err.customMessage.trim());
  }

  const data =
    err?.response?.data ??
    (err?.detail != null ? {detail: err.detail} : undefined) ??
    (isRecord(error) ? error : undefined);

  const messages = collectMessages(data, field);
  if (messages[0]) {
    return finish(messages[0]);
  }

  if (typeof err?.message === 'string' && err.message.trim()) {
    if (!err.message.startsWith('Request failed with status code')) {
      return finish(err.message.trim());
    }
  }

  return fallback;
}
