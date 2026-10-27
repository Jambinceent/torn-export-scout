import type { BazaarOffer } from './bazaar';
import type { ExportRow, MarketListing } from './torn';

export interface ShoppingOffer {
  key: string;
  itemId: number;
  source: 'market' | 'bazaar';
  sellerName: string;
  url: string;
  price: number;
  quantity: number;
  updatedAt: number | null;
}

export interface ShoppingLine extends ShoppingOffer {
  itemName: string;
  exportPrice: number;
  buyQuantity: number;
  profitPerUnit: number;
}

export interface Purchase extends ShoppingLine {
  purchaseId: number;
}

export function combineOffers(itemId: number, listings: MarketListing[], bazaars: BazaarOffer[]): ShoppingOffer[] {
  // Market identity is price-based: aggregate equal-price stock instead of double-counting rows.
  const market = new Map<number, number>();
  for (const listing of listings) {
    if (Number.isFinite(listing.price) && listing.price > 0 && Number.isSafeInteger(listing.amount) && listing.amount > 0) {
      market.set(listing.price, (market.get(listing.price) ?? 0) + listing.amount);
    }
  }
  const offers: ShoppingOffer[] = [...market].map(([price, quantity]) => ({
    key: `${itemId}:market:${price}`, itemId, source: 'market', sellerName: 'Torn item market',
    url: `https://www.torn.com/imarket.php#/p=shop&step=shop&type=&searchname=&ID=${itemId}`,
    price, quantity, updatedAt: null,
  }));
  const seen = new Set<number>();
  for (const offer of bazaars) {
    if (seen.has(offer.sellerId) || !Number.isSafeInteger(offer.sellerId) || offer.sellerId <= 0
      || !Number.isFinite(offer.price) || offer.price <= 0 || !Number.isSafeInteger(offer.quantity) || offer.quantity <= 0) continue;
    seen.add(offer.sellerId);
    offers.push({ key: `${itemId}:bazaar:${offer.sellerId}`, itemId, source: 'bazaar',
      sellerName: offer.sellerName, url: `https://www.torn.com/bazaar.php?userID=${offer.sellerId}`,
      price: offer.price, quantity: offer.quantity, updatedAt: offer.updatedAt });
  }
  return offers.sort((a, b) => a.price - b.price || a.key.localeCompare(b.key));
}

export function planShopping(rows: ExportRow[], targets: Record<number, number>, offers: Record<number, ShoppingOffer[]>,
  purchases: Purchase[], unavailable: Set<string>, slots: number): ShoppingLine[] {
  const usedSlots = purchases.reduce((sum, p) => sum + p.buyQuantity, 0);
  let capacity = Math.max(0, Math.floor(slots) - usedSlots);
  const lines: ShoppingLine[] = [];
  // Preserve the customer's chosen item order; this is a shortlist, not an optimal-budget solver.
  for (const row of rows) {
    const bought = purchases.filter(p => p.itemId === row.item.id).reduce((sum, p) => sum + p.buyQuantity, 0);
    const saleCap = /weapon|armor|armour/i.test(row.item.type) ? 100 : Infinity;
    let remaining = Math.max(0, Math.min(Math.floor(targets[row.item.id] ?? 0), saleCap) - bought);
    for (const offer of offers[row.item.id] ?? []) {
      if (unavailable.has(offer.key) || offer.price >= row.exportPrice) continue;
      const used = purchases.filter(p => p.key === offer.key).reduce((sum, p) => sum + p.buyQuantity, 0);
      const buyQuantity = Math.min(remaining, capacity, Math.max(0, offer.quantity - used));
      if (buyQuantity <= 0) continue;
      lines.push({ ...offer, itemName: row.item.name, exportPrice: row.exportPrice,
        buyQuantity, profitPerUnit: row.exportPrice - offer.price });
      remaining -= buyQuantity;
      capacity -= buyQuantity;
    }
  }
  return lines;
}

export function freshness(updatedAt: number | null, now: number): { label: string; stale: boolean } {
  if (updatedAt === null) return { label: 'Age unknown', stale: true };
  const minutes = Math.max(0, Math.floor((now - updatedAt * 1000) / 60000));
  return { label: minutes < 1 ? 'Checked <1m ago' : minutes < 60 ? `Checked ${minutes}m ago` : `Checked ${Math.floor(minutes / 60)}h ago`, stale: minutes >= 15 };
}

// Conservative per-browser-session guard; provider-wide anonymous limits are not known.
export class BazaarRequestGuard {
  private calls: number[] = [];
  private lastCall: number | null = null;
  private pausedUntil = 0;
  private dailyCalls = 0;
  private day: number | null = null;

  reserve(now: number): string | null {
    const day = Math.floor(now / 86400000);
    if (day !== this.day) { this.dailyCalls = 0; this.day = day; }
    this.calls = this.calls.filter(time => now - time < 60000);
    if (now < this.pausedUntil) return 'TornW3B is cooling down. Wait a minute before trying again.';
    if (this.dailyCalls >= 900) return 'This session reached its daily safety limit. Try again tomorrow.';
    if (this.calls.length >= 20) return 'This session reached 20 requests in a minute. Wait before trying again.';
    if (this.lastCall !== null && now - this.lastCall < 3000) return 'Please wait three seconds between seller requests.';
    this.calls.push(now); this.lastCall = now; this.dailyCalls += 1;
    return null;
  }

  pause(now: number) { this.pausedUntil = now + 60000; }
}
// Max-profit suitcase: greedily fill free slots with the highest profit-per-unit offers across all goods.
// With only a slot limit (no budget), this greedy order is optimal.
export function recommendSuitcase(rows: ExportRow[], offers: Record<number, ShoppingOffer[]>, slots: number): ShoppingLine[] {
  const candidates = rows.flatMap(row => (offers[row.item.id] ?? [])
    .filter(offer => offer.price < row.exportPrice)
    .map(offer => ({ row, offer, profit: row.exportPrice - offer.price })))
    .sort((a, b) => b.profit - a.profit || a.offer.key.localeCompare(b.offer.key));
  let capacity = Math.max(0, Math.floor(slots));
  const perItem = new Map<number, number>();
  const lines: ShoppingLine[] = [];
  for (const { row, offer, profit } of candidates) {
    if (capacity <= 0) break;
    const cap = /weapon|armor|armour/i.test(row.item.type) ? 100 : Infinity;
    const used = perItem.get(row.item.id) ?? 0;
    const buyQuantity = Math.min(capacity, offer.quantity, cap - used);
    if (buyQuantity <= 0) continue;
    lines.push({ ...offer, itemName: row.item.name, exportPrice: row.exportPrice, buyQuantity, profitPerUnit: profit });
    perItem.set(row.item.id, used + buyQuantity);
    capacity -= buyQuantity;
  }
  return lines;
}
