import { SimpleFinMapService } from './simplefin-map.service';

describe('SimpleFinMapService', () => {
  let map: SimpleFinMapService;

  beforeEach(() => {
    map = new SimpleFinMapService();
  });

  it('skips pending transactions', () => {
    expect(
      map.shouldImportSimpleFinTransaction({
        id: '1',
        posted: 100,
        amount: '-10',
        description: 'Coffee',
        pending: true,
      }),
    ).toBe(false);
  });

  it('maps posted transaction with ISO date', () => {
    const out = map.mapSimpleFinTransaction('acct-1', {
      id: 'tx-9',
      posted: 978366153,
      amount: '-12.50',
      description: 'Cafe',
    });
    expect(out).toEqual({
      simplefinAccountId: 'acct-1',
      externalId: 'tx-9',
      postedAt: map.unixToIsoDateTime(978366153),
      amount: -12.5,
      description: 'Cafe',
    });
  });

  it('maps account with institution from connection', () => {
    const out = map.mapSimpleFinAccount(
      {
        id: '2930002',
        name: 'Savings',
        conn_id: 'CON-1',
        currency: 'USD',
        balance: '100.23',
        'balance-date': 978366153,
        transactions: [],
      },
      { 'CON-1': 'My Bank - Jill' },
    );
    expect(out.simplefinAccountId).toBe('2930002');
    expect(out.institution).toBe('My Bank - Jill');
    expect(out.balance).toBe(100.23);
  });

  it('normalizeAccountSet extracts accounts and transactions', () => {
    const out = map.normalizeAccountSet({
      errlist: [{ msg: 'warn' }],
      connections: [{ conn_id: 'C1', name: 'Bank' }],
      accounts: [
        {
          id: 'a1',
          name: 'Checking',
          currency: 'USD',
          balance: '100',
          transactions: [
            {
              id: 't1',
              posted: 978366153,
              amount: '-5',
              description: 'Snack',
            },
          ],
        },
      ],
    });
    expect(out.errors).toEqual(['warn']);
    expect(out.accounts).toHaveLength(1);
    expect(out.transactions).toHaveLength(1);
    expect(out.transactions[0].description).toBe('Snack');
  });
});
