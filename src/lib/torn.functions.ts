import { createServerFn } from "@tanstack/react-start";
import { scanTornMarket } from "./torn-api.server";
import type { ForeignStockEntry, MarketListing, TornItem } from "./torn";

export interface TornMarketData {
  items: TornItem[];
  listingsByItem: Record<number, MarketListing[]>;
  countryStock: Record<string, ForeignStockEntry[]>;
  countryStockSource: "yata" | "none";
}

export const fetchTornMarket = createServerFn({ method: "POST" })
  .inputValidator((input: { apiKey: string; country: string }) => {
    if (typeof input?.apiKey !== "string" || !input.apiKey.trim()) {
      throw new Error("An API key is required.");
    }
    return { apiKey: input.apiKey.trim(), country: input.country };
  })
  .handler(async ({ data }): Promise<{ data: TornMarketData | null; error: string | null }> => {
    try {
      return { data: await scanTornMarket(data.apiKey, data.country), error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : "The scan failed. Try again." };
    }
  });