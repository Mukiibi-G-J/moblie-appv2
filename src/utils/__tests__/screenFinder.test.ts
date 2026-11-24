import {filterScreens, type ScreenFinderItem} from '../screenFinder';

const items: ScreenFinderItem[] = [
  {
    key: 'items',
    label: 'Items',
    section: 'Inventory',
    keywords: 'stock products catalog inventory',
  },
  {
    key: 'profitLoss',
    label: 'Profit & Loss',
    section: 'Sales & reports',
    keywords: 'p and l pnl profit and loss income statement',
  },
  {
    key: 'suppliers',
    label: 'Suppliers',
    section: 'Customers & suppliers',
    keywords: 'vendors creditors',
  },
  {
    key: 'restaurant-kitchen',
    label: 'Kitchen display',
    section: 'Restaurant',
    keywords: 'kds kitchen tickets display',
  },
  {
    key: 'settings',
    label: 'Settings',
    section: 'App & account',
    keywords: 'settings preferences printer print',
  },
  {
    key: 'printerConfig',
    label: 'Printer configuration',
    section: 'App & account',
    keywords: 'printer print receipt bluetooth usb sunmi thermal',
  },
  {
    key: 'receiptLayout',
    label: 'Receipt layout',
    section: 'App & account',
    keywords:
      'receipt layout template look design format slip how the receipt looks',
  },
  {
    key: 'generalSetup',
    label: 'General setup',
    section: 'Company',
    keywords:
      'general ledger setup gl setup g/l setup vat currency branches',
  },
];

describe('filterScreens', () => {
  it('returns nothing until there is a query', () => {
    expect(filterScreens(items, '')).toEqual([]);
    expect(filterScreens(items, '   ')).toEqual([]);
  });

  it('matches a label, a section, and an alias', () => {
    expect(filterScreens(items, 'item').map(item => item.key)).toEqual([
      'items',
    ]);
    expect(filterScreens(items, 'inventory').map(item => item.key)).toEqual([
      'items',
    ]);
    expect(filterScreens(items, 'stock').map(item => item.key)).toEqual([
      'items',
    ]);
    expect(filterScreens(items, 'vendors').map(item => item.key)).toEqual([
      'suppliers',
    ]);
  });

  it('treats p&l as profit and loss', () => {
    expect(filterScreens(items, 'p&l').map(item => item.key)).toEqual([
      'profitLoss',
    ]);
    expect(filterScreens(items, 'pnl').map(item => item.key)).toEqual([
      'profitLoss',
    ]);
  });

  it('matches printer configuration by printer aliases', () => {
    expect(filterScreens(items, 'printer').map(item => item.key)).toEqual([
      'settings',
      'printerConfig',
    ]);
    expect(filterScreens(items, 'bluetooth').map(item => item.key)).toEqual([
      'printerConfig',
    ]);
  });

  it('matches receipt layout by receipt and layout', () => {
    expect(filterScreens(items, 'receipt').map(item => item.key)).toEqual([
      'printerConfig',
      'receiptLayout',
    ]);
    expect(filterScreens(items, 'layout').map(item => item.key)).toEqual([
      'receiptLayout',
    ]);
  });

  it('matches general setup by partial name and aliases', () => {
    expect(filterScreens(items, 'General se').map(item => item.key)).toEqual([
      'generalSetup',
    ]);
    expect(filterScreens(items, 'g/l setup').map(item => item.key)).toEqual([
      'generalSetup',
    ]);
    expect(filterScreens(items, 'vat').map(item => item.key)).toEqual([
      'generalSetup',
    ]);
  });

  it('matches restaurant screens by alias', () => {
    expect(filterScreens(items, 'kds').map(item => item.key)).toEqual([
      'restaurant-kitchen',
    ]);
    expect(filterScreens(items, 'kitchen').map(item => item.key)).toEqual([
      'restaurant-kitchen',
    ]);
  });
});
