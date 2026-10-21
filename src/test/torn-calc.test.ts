import { describe, expect, it } from "vitest";

import { buildExportRow, exportPriceFor, isBlackMarketDefault, rankByProfit } from "../lib/torn";

describe("Travel 3.0 export rules", () => {
  it("pays 75% of NPC price for regular items", () => {
    expect(exportPriceFor(1_000_000, false)).toBe(750_000);
  });

  it("pays 100% of NPC price for black market items", () => {
    expect(exportPriceFor(1_000_000, true)).toBe(1_000_000);
  });

  it("treats drugs as black market by default", () => {
    expect(isBlackMarketDefault({ type: "Drug" })).toBe(true);
    expect(isBlackMarketDefault({ type: "Flower" })).toBe(false);
  });

  it("computes profit as export price minus cheapest listing", () => {
    const row = buildExportRow(
      { id: 1, name: "Xanax", type: "Drug", market_value: 850_000 },
      [
        { price: 800_000, amount: 3 },
        { price: 700_000, amount: 1 },
      ],
      true,
    );
    expect(row.exportPrice).toBe(850_000);
    expect(row.cheapestPrice).toBe(700_000);
    expect(row.profitPerUnit).toBe(150_000);
  });

  it("marks items with no listings as unprofitable (null profit)", () => {
    const row = buildExportRow(
      { id: 2, name: "Dahlia", type: "Flower", market_value: 300 },
      undefined,
      false,
    );
    expect(row.profitPerUnit).toBeNull();
    expect(row.cheapestPrice).toBeNull();
  });

  it("ranks highest profit per unit first", () => {
    const rows = rankByProfit([
      buildExportRow({ id: 1, name: "A", type: "Flower", market_value: 1000 }, [{ price: 900, amount: 1 }], false),
      buildExportRow({ id: 2, name: "B", type: "Drug", market_value: 1000 }, [{ price: 500, amount: 1 }], true),
    ]);
    expect(rows[0].item.name).toBe("B");
  });
});
