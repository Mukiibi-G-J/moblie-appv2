import {
  buildIdleCustomerDisplay,
  linesFromCartItems,
} from '../customerDisplay';

describe('customerDisplay', () => {
  it('builds welcome payload', () => {
    const idle = buildIdleCustomerDisplay(
      'THE ADRACE EXECUTIVE Copy',
      'https://example.com/adrace.png',
    );
    expect(idle.mode).toBe('idle');
    expect(idle.companyName).toBe('THE ADRACE EXECUTIVE Copy');
    expect(idle.companyLogo).toBe('https://example.com/adrace.png');
    expect(idle.heading).toBe('Welcome');
  });

  it('formats cart lines for the customer screen', () => {
    const lines = linesFromCartItems([
      {item_name: 'Chapati', quantity: 2, unit_price: 2000},
    ]);
    expect(lines).toEqual([
      {name: 'Chapati', qtyLabel: '2×', amount: 'UGX 4,000'},
    ]);
  });
});
