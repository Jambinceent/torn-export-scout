import { describe, expect, it } from "vitest";
import { rankBazaarOffers, type BazaarOffer } from "../lib/bazaar";

const offer: BazaarOffer = {
  sellerId: 123, sellerName: "Example seller", price: 700000,
  quantity: 4, updatedAt: null,
};

describe("Bazaar export comparison", () => {
  it("subtracts the bazaar purchase price from the export payout", () => {
    expect(rankBazaarOffers([offer], 900000, 20)[0]?.profitPerUnit).toBe(200000);
  });
  it("limits the estimated purchase to stock and suitcase capacity", () => {
    const result = rankBazaarOffers([offer], 900000, 3)[0];
    expect(result?.purchasableQuantity).toBe(3);
    expect(result?.totalProfit).toBe(600000);
    expect(rankBazaarOffers([offer], 900000, 20)[0]?.purchasableQuantity).toBe(4);
  });
  it("ranks cheapest offers first and excludes sold-out offers", () => {
    const result = rankBazaarOffers([
      offer, { ...offer, sellerId: 124, price: 600000 },
      { ...offer, sellerId: 125, quantity: 0 },
    ], 900000, 20);
    expect(result.map((entry) => entry.sellerId)).toEqual([124, 123]);
  });
});