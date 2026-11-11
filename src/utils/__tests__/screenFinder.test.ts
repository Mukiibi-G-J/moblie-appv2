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
    keywords: 'settings preferences',
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

  it('matches restaurant screens by alias', () => {
    expect(filterScreens(items, 'kds').map(item => item.key)).toEqual([
      'restaurant-kitchen',
    ]);
    expect(filterScreens(items, 'kitchen').map(item => item.key)).toEqual([
      'restaurant-kitchen',
    ]);
  });
});
