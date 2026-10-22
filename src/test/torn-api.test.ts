import { afterEach, describe, expect, it, vi } from "vitest";
import { scanTornMarket } from "../lib/torn-api.server";

afterEach(() => vi.unstubAllGlobals());

describe("Torn v2 scan regression", () => {
  it("requests the destination item's ID and parses v2 prices and YATA stocks", async () => {
    const paths: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      paths.push(path);
      if (path === "/v2/torn/items") return Response.json({ items: [
        { id: 206, name: "Xanax", type: "Drug", value: { market_price: 850000 } },
        { id: 260, name: "Dahlia", type: "Flower", value: { market_price: 300 } },
      ] });
      if (path === "/api/v1/travel/export/") return Response.json({ stocks: {
        jap: { stocks: [{ id: 206, cost: 900000, quantity: 0 }] },
        mex: { stocks: [{ id: 260, cost: 300, quantity: 20 }] },
      } });
      if (path === "/v2/market/206/itemmarket") return Response.json({ itemmarket: {
        item: { id: 206 }, listings: [{ price: 700000, amount: 4 }, { price: 1, amount: 0 }],
      } });
      throw new Error("Unexpected API endpoint");
    }));
    const result = await scanTornMarket("test-only", "jap");
    expect(paths).toEqual(["/v2/torn/items", "/api/v1/travel/export/", "/v2/market/206/itemmarket"]);
    expect(result.items.map((item) => item.id)).toEqual([206]);
    expect(result.items[0]?.market_value).toBe(850000);
    expect(result.countryStock['jap']).toEqual([{ itemId: 206, price: 900000, quantity: 0 }]);
    expect(result.listingsByItem[206]).toEqual([{ price: 700000, amount: 4 }]);
  });

  it("does not substitute market values when destination prices are unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(
      url.includes("torn/items") ? { items: [] } : { stocks: {} },
    )));
    await expect(scanTornMarket("test-only", "jap")).rejects.toThrow("Destination shop prices are unavailable");
  });
});