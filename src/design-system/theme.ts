import designSystem from './design-system.json';

export const DS = designSystem;

export function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Brand gradient for `react-native-linear-gradient` */
export const gradientBrand = {
  colors: [DS.brand.primary, DS.brand.secondary] as [string, string],
  start: {x: 0, y: 0},
  end: {x: 1, y: 1},
};

export const light = DS.color.schemes.light;
export const utility = DS.color.utility;
export const spacing = DS.spacing;
export const radii = DS.radii;
export const typography = DS.typography.scale;
