import { describe, expect, it } from 'vitest';
import { BazaarRequestGuard, combineOffers, freshness, planShopping, type Purchase } from '../lib/shopping';
import { buildExportRow } from '../lib/torn';

const row = buildExportRow({ id: 1, name: 'Export good', type: 'Drug', market_value: 100 }, 100, [], true);
const offers = combineOffers(1, [{ price: 60, amount: 3 }], [
  { sellerId: 10, sellerName: 'Cheap', price: 50, quantity: 2, updatedAt: null },
  { sellerId: 11, sellerName: 'Backup', price: 70, quantity: 10, updatedAt: null },
]);

describe('combined shopping shortlist', () => {
  it('splits five units across cheapest bazaar stock then item market', () => {
    const lines = planShopping([row], { 1: 5 }, { 1: offers }, [], new Set(), 20);
    expect(lines.map(p => [p.source, p.buyQuantity, p.price])).toEqual([['bazaar', 2, 50], ['market', 3, 60]]);
    expect(lines.reduce((sum, p) => sum + p.buyQuantity * p.profitPerUnit, 0)).toBe(220);
  });
  it('uses the next fetched seller when the cheapest stock is unavailable', () => {
    const lines = planShopping([row], { 1: 5 }, { 1: offers }, [], new Set(['1:bazaar:10']), 20);
    expect(lines.map(p => [p.key, p.buyQuantity])).toEqual([['1:market:60', 3], ['1:bazaar:11', 2]]);
  });
  it('deduplicates sellers returned on overlapping pages', () => {
    const seller = { sellerId: 10, sellerName: 'Cheap', price: 50, quantity: 2, updatedAt: null };
    expect(combineOffers(1, [], [seller, seller])).toHaveLength(1);
  });
  it('reduces desired quantities and free slots after a confirmed purchase', () => {
    const first = planShopping([row], { 1: 5 }, { 1: offers }, [], new Set(), 4)[0];
    if (!first) throw new Error('Expected first offer');
    const purchases: Purchase[] = [{ ...first, purchaseId: 1 }];
    const remaining = planShopping([row], { 1: 5 }, { 1: offers }, purchases, new Set(), 4);
    expect(remaining.map(p => [p.source, p.buyQuantity])).toEqual([['market', 2]]);
  });
  it('enforces one shared luggage capacity across goods', () => {
    const second = { ...row, item: { ...row.item, id: 2 } };
    const secondOffers = combineOffers(2, [{ price: 40, amount: 10 }], []);
    expect(planShopping([row, second], { 1: 3, 2: 3 }, { 1: offers, 2: secondOffers }, [], new Set(), 4)
      .reduce((sum, p) => sum + p.buyQuantity, 0)).toBe(4);
  });
  it('does not recommend offers at or above the export payout', () => {
    expect(planShopping([row], { 1: 5 }, { 1: combineOffers(1, [{ price: 100, amount: 5 }], []) }, [], new Set(), 20)).toEqual([]);
  });
  it('caps weapon and armor quantities at 100 per item', () => {
    const weapon = { ...row, item: { ...row.item, type: 'Melee Weapon' } };
    const armor = { ...row, item: { ...row.item, type: 'Armor' } };
    const stock = { 1: combineOffers(1, [{ price: 50, amount: 200 }], []) };
    expect(planShopping([weapon], { 1: 150 }, stock, [], new Set(), 200)[0]?.buyQuantity).toBe(100);
    expect(planShopping([armor], { 1: 150 }, stock, [], new Set(), 200)[0]?.buyQuantity).toBe(100);
  });
  it('flags fifteen-minute-old and unknown listings', () => {
    expect(freshness(1000, 1000000 + 15 * 60000).stale).toBe(true);
    expect(freshness(1000, 1000000 + 14 * 60000).stale).toBe(false);
    expect(freshness(null, 1000000).stale).toBe(true);
  });
});

describe('session seller request safety', () => {
  it('allows only one request within three seconds', () => {
    const guard = new BazaarRequestGuard();
    expect(guard.reserve(0)).toBeNull();
    expect(guard.reserve(2999)).toContain('three seconds');
    expect(guard.reserve(3000)).toBeNull();
  });
  it('limits a session to twenty requests in a rolling minute', () => {
    const guard = new BazaarRequestGuard();
    for (let i = 0; i < 20; i++) expect(guard.reserve(i * 3000)).toBeNull();
    // A boundary burst is blocked independently of the minimum interval.
    expect(guard.reserve(59999)).toContain('20 requests');
    expect(guard.reserve(60000)).toBeNull();
  });
  it('pauses for a minute after a provider limit', () => {
    const guard = new BazaarRequestGuard();
    guard.pause(0);
    expect(guard.reserve(59999)).toContain('cooling down');
    expect(guard.reserve(60000)).toBeNull();
  });
  it('caps a session at 900 calls per UTC day and resets next day', () => {
    const guard = new BazaarRequestGuard();
    for (let i = 0; i < 900; i++) expect(guard.reserve(i * 60000)).toBeNull();
    expect(guard.reserve(900 * 60000)).toContain('daily safety limit');
    expect(guard.reserve(86400000)).toBeNull();
  });
});
describe('max-profit suitcase recommendation', () => {
  it('fills slots with the highest profit offers across goods', async () => {
    const { recommendSuitcase } = await import('../lib/shopping');
    const second = { ...row, item: { ...row.item, id: 2 } };
    const secondOffers = combineOffers(2, [], [{ sellerId: 20, sellerName: 'Best', price: 10, quantity: 3, updatedAt: null }]);
    const lines = recommendSuitcase([row, second], { 1: offers, 2: secondOffers }, 5);
    expect(lines.map(l => [l.key, l.buyQuantity])).toEqual([['2:bazaar:20', 3], ['1:bazaar:10', 2]]);
  });
});
