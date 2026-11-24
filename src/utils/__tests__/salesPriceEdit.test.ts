import {
  canEditSalesUnitPrice,
  formatSalesPriceDraft,
  formatSalesPriceInput,
  parseSalesPriceInput,
  resolveEditedSalesPrice,
} from '../salesPriceEdit';

describe('canEditSalesUnitPrice', () => {
  it('requires User Setup canEditSalesPrice', () => {
    expect(canEditSalesUnitPrice({canEditSalesPrice: true})).toBe(true);
    expect(canEditSalesUnitPrice({canEditSalesPrice: false})).toBe(false);
    expect(canEditSalesUnitPrice({})).toBe(false);
  });

  it('blocks when company setup disables price editing', () => {
    expect(
      canEditSalesUnitPrice({
        canEditSalesPrice: true,
        disablePriceEditing: true,
      }),
    ).toBe(false);
  });
});

describe('resolveEditedSalesPrice', () => {
  it('can block prices below original', () => {
    expect(
      resolveEditedSalesPrice({
        requested: 1000,
        originalPrice: 5000,
        preventBelowOriginal: true,
      }),
    ).toEqual({price: 5000, blockedBelowOriginal: true});
  });
});

describe('parseSalesPriceInput / formatSalesPriceInput', () => {
  it('parses and formats round-trip values', () => {
    expect(parseSalesPriceInput('1,500.50')).toBe(1500.5);
    expect(formatSalesPriceInput(1500)).toBe('1,500');
    expect(formatSalesPriceInput(1500.5)).toBe('1,500.5');
    expect(formatSalesPriceInput(60000000000)).toBe('60,000,000,000');
    expect(parseSalesPriceInput('60,000,000,000')).toBe(60000000000);
  });

  it('inserts commas while typing and keeps a trailing decimal', () => {
    expect(formatSalesPriceDraft('60000000000')).toBe('60,000,000,000');
    expect(formatSalesPriceDraft('1500.')).toBe('1,500.');
    expect(formatSalesPriceDraft('')).toBe('');
  });
});
