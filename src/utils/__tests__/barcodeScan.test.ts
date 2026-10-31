import {pickItemByScanCode} from '../barcodeScan';

describe('pickItemByScanCode', () => {
  const jesa = {
    no: 'ITM-002517',
    item_name: 'Jesa Milk sacket 500ml',
    bar_code_no: '6161103270449|6161103270463',
  };
  const other = {
    no: 'ITM-000009',
    item_name: 'Other',
    bar_code_no: '1111111111111',
  };

  it('queues the item from either barcode when two are separated by |', () => {
    expect(pickItemByScanCode([other, jesa], '6161103270463')).toEqual(jesa);
    expect(pickItemByScanCode([other, jesa], '6161103270449')).toEqual(jesa);
  });

  it('does not pick when two items share the scanned code', () => {
    const shared = '6161103270463';
    expect(
      pickItemByScanCode(
        [jesa, {...other, bar_code_no: shared}],
        shared,
      ),
    ).toBeNull();
  });
});
