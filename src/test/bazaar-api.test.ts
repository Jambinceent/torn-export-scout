import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeBazaarPage, scanBazaarItem } from "../lib/bazaar-api.server";

afterEach(() => vi.unstubAllGlobals());

describe("TornW3B bazaar feed", () => {
  it("maps live provider seller fields and timestamps, rejecting unavailable and unrelated stock", () => {
    const listing = { item_id: 206, player_id: 4134654, player_name: "yanglei", price: 873000, quantity: 8, last_checked: 1792752845 };
    expect(normalizeBazaarPage({ item_id: 206, generated_at: 1792752900, has_more: true, listings: [
      listing, { ...listing, quantity: 0 }, { ...listing, item_id: 260 }, { ...listing, player_id: -1 },
    ] }, 206, 1)).toEqual({ offers: [{ sellerId: 4134654, sellerName: "yanglei", price: 873000, quantity: 8, updatedAt: 1792752845 }],
      page: 1, hasMore: true, generatedAt: 1792752900 });
  });
  it("requests only the selected item's public page without credentials", async () => {
    const request = vi.fn(async () => Response.json({ item_id: 206, listings: [], has_more: false }));
    vi.stubGlobal("fetch", request);
    await scanBazaarItem(206, 2);
    expect(request).toHaveBeenCalledWith("https://weav3r.dev/api/marketplace/206?page=2", expect.objectContaining({ headers: { accept: "application/json" } }));
  });
  it("returns an actionable provider rate-limit error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Too many requests", { status: 429 })));
    await expect(scanBazaarItem(206)).rejects.toThrow("Wait a minute");
  });
  it("rejects a mismatched item response", () => {
    expect(() => normalizeBazaarPage({ item_id: 260, listings: [] }, 206, 1)).toThrow("for this item");
  });
});