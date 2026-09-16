import {
  constrainedWidthStyle,
  isWideLayout,
  PAGE_CONTENT_MAX_WIDTH,
  posCatalogColumnCount,
  SHEET_MAX_WIDTH,
  WIDE_LAYOUT_BREAKPOINT,
} from '../layout';

describe('isWideLayout', () => {
  it('keeps phones in the stacked layout', () => {
    expect(isWideLayout(360)).toBe(false);
    expect(isWideLayout(430)).toBe(false);
    expect(isWideLayout(WIDE_LAYOUT_BREAKPOINT - 1)).toBe(false);
    expect(isWideLayout(390, 844)).toBe(false);
  });

  it('uses the dashboard grid on large POS screens', () => {
    expect(isWideLayout(WIDE_LAYOUT_BREAKPOINT)).toBe(true);
    expect(isWideLayout(1280)).toBe(true);
  });

  it('treats landscape POS / tablets as wide even under the portrait breakpoint', () => {
    expect(isWideLayout(640, 360)).toBe(true);
    expect(isWideLayout(1024, 600)).toBe(true);
  });
});

describe('posCatalogColumnCount', () => {
  it('uses two columns on phones', () => {
    expect(posCatalogColumnCount(390, 844)).toBe(2);
  });

  it('uses three columns on landscape POS tablets', () => {
    expect(posCatalogColumnCount(640, 360)).toBe(3);
    expect(posCatalogColumnCount(800, 480)).toBe(3);
  });

  it('uses four columns on wide POS screens', () => {
    expect(posCatalogColumnCount(1280, 800)).toBe(4);
  });
});

describe('constrainedWidthStyle', () => {
  it('leaves phone layouts full width', () => {
    expect(constrainedWidthStyle(390, PAGE_CONTENT_MAX_WIDTH, 844)).toEqual({
      width: '100%',
    });
  });

  it('caps and centers sheets on large screens', () => {
    expect(constrainedWidthStyle(1280, SHEET_MAX_WIDTH, 800)).toEqual({
      width: '100%',
      maxWidth: SHEET_MAX_WIDTH,
      alignSelf: 'center',
    });
  });
});
