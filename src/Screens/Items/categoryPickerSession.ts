export type CategoryPickerMode = 'create' | 'edit';

export type CategoryPickerSession = {
  mode: CategoryPickerMode;
  draft: Record<string, any> | null;
  categoryCode?: string | null;
};

type Listener = (session: CategoryPickerSession) => void;

let session: CategoryPickerSession | null = null;
let readyToConsume = false;
let pickingCategory = false;
let listener: Listener | null = null;

export function isPickingCategory(): boolean {
  return pickingCategory;
}

export function startCategoryPickerSession(
  mode: CategoryPickerMode,
  draft: Record<string, any> | null,
): void {
  session = {mode, draft};
  readyToConsume = false;
  pickingCategory = true;
}

export function ensureCategoryPickerSession(
  mode: CategoryPickerMode,
  draft: Record<string, any> | null,
): void {
  if (!session) {
    startCategoryPickerSession(mode, draft);
  }
}

export function finishCategoryPickerSession(
  categoryCode?: string | null,
): CategoryPickerSession | null {
  if (!session) {
    pickingCategory = false;
    return null;
  }
  const result = {...session, categoryCode};
  pickingCategory = false;
  if (listener) {
    session = null;
    readyToConsume = false;
    listener(result);
    return result;
  }
  session = result;
  readyToConsume = true;
  return result;
}

export function consumeCategoryPickerSession(): CategoryPickerSession | null {
  if (!readyToConsume || !session) {
    return null;
  }
  const current = session;
  session = null;
  readyToConsume = false;
  pickingCategory = false;
  return current;
}

export function subscribeCategoryPickerResult(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) {
      listener = null;
    }
  };
}
