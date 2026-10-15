import {normalizeSalesUiMode, salesUiStorageKey} from '../salesUiMode';

describe('normalizeSalesUiMode', () => {
  it('defaults unknown values to phone', () => {
    expect(normalizeSalesUiMode(undefined)).toBe('phone');
    expect(normalizeSalesUiMode('')).toBe('phone');
    expect(normalizeSalesUiMode('phone')).toBe('phone');
  });

  it('accepts POS aliases', () => {
    expect(normalizeSalesUiMode('pos')).toBe('pos');
    expect(normalizeSalesUiMode('POS')).toBe('pos');
    expect(normalizeSalesUiMode('Point of Sale')).toBe('pos');
    expect(normalizeSalesUiMode('desktop')).toBe('pos');
  });
});

describe('salesUiStorageKey', () => {
  it('scopes the override to the signed-in user', () => {
    expect(salesUiStorageKey(12)).toBe('sales_ui_mode:12');
    expect(salesUiStorageKey(null)).toBe('sales_ui_mode:anon');
  });
});
