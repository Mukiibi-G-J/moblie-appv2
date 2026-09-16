export const WIDE_LAYOUT_BREAKPOINT = 720;
export const LANDSCAPE_WIDE_MIN_WIDTH = 480;
export const PAGE_CONTENT_MAX_WIDTH = 1100;
export const SHEET_MAX_WIDTH = 560;
export const TAB_BAR_CONTENT_MAX_WIDTH = 560;

export function isWideLayout(width: number, height?: number): boolean {
  if (width >= WIDE_LAYOUT_BREAKPOINT) {
    return true;
  }
  // Landscape POS terminals often report <720dp but are still too wide for phone layouts.
  return (
    height != null && width > height && width >= LANDSCAPE_WIDE_MIN_WIDTH
  );
}

/** Product tiles on Make Sale POS: 2 on phones, 3–4 on tablets. */
export function posCatalogColumnCount(width: number, height?: number): number {
  if (width >= 1100) {
    return 4;
  }
  if (isWideLayout(width, height) || width >= 600) {
    return 3;
  }
  return 2;
}

export function constrainedWidthStyle(
  width: number,
  maxWidth: number,
  height?: number,
): {
  width: '100%';
  maxWidth?: number;
  alignSelf?: 'center';
} {
  if (!isWideLayout(width, height)) {
    return {width: '100%'};
  }
  return {
    width: '100%',
    maxWidth,
    alignSelf: 'center',
  };
}
