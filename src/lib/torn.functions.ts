import { createServerFn } from "@tanstack/react-start";

import type { MarketListing, TornItem } from "./torn";

// Server-side proxy for the Torn API v2 plus the YATA abroad-stock feed.
// The user's API key is sent with each request and never stored server-side.

interface TornItemsResponse {
  items?: Array<{
    id: number;
    name: string;
    type: string;
    market_value: number;
    image?: string;
  }>;
  error?: { code: number; error: string };
}

interface TornMarketResponse {
  itemmarket?: Array<{
    id: number;
    average_price?: number;
    listings?: Array<{ price: number; amount: number }>;
  }>;
  error?: { code: number; error: string };
}

// YATA travel/export feed: abroad stock per country. Shape is community-run
// and not formally versioned, so parsing is defensive.
interface YataExportResponse {
  stocks?: Record<
    string,
    {
      items?: Array<{ id?: number; item_id?: number; quantity?: number }>;
    }
  >;
}

export interface TornMarketData {
  items: TornItem[];
  listingsByItem: Record<number, MarketListing[]>;
  // country code -> item ids that country's shop stocks (exportable there)
  countryStock: Record<string, number[]>;
  countryStockSource: "yata" | "none";
}

async function tornFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Torn API request failed (HTTP ${res.status})`);
  }
  const data = (await res.json()) as T & { error?: { code: number; error: string } };
  if (data.error) {
    throw new Error(`Torn API error ${data.error.code}: ${data.error.error}`);
  }
  return data;
}

async function fetchCountryStock(): Promise<{
  countryStock: Record<string, number[]>;
  source: "yata" | "none";
}> {
  try {
    const res = await fetch("https://yata.yt/api/v1/travel/export/", {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return { countryStock: {}, source: "none" };
    const data = (await res.json()) as YataExportResponse;
    const countryStock: Record<string, number[]> = {};
    for (const [code, stock] of Object.entries(data.stocks ?? {})) {
      const ids = (stock.items ?? [])
        .map((i) => i.id ?? i.item_id)
        .filter((id): id is number => typeof id === "number");
      countryStock[code] = ids;
    }
    return { countryStock, source: "yata" };
  } catch {
    // Country stock is a filter aid, not core data — degrade gracefully.
    return { countryStock: {}, source: "none" };
  }
}

export const fetchTornMarket = createServerFn({ method: "POST" })
  .inputValidator((input: { apiKey: string }) => {
    if (!input?.apiKey || typeof input.apiKey !== "string") {
      throw new Error("An API key is required.");
    }
    return { apiKey: input.apiKey.trim() };
  })
  .handler(async ({ data }): Promise<TornMarketData> => {
    const key = encodeURIComponent(data.apiKey);

    const [itemsRes, marketRes, stock] = await Promise.all([
      tornFetch<TornItemsResponse>(`https://api.torn.com/v2/torn/items?key=${key}`),
      tornFetch<TornMarketResponse>(
        `https://api.torn.com/v2/market/?selections=itemmarket&key=${key}`,
      ),
      fetchCountryStock(),
    ]);

    const items: TornItem[] = (itemsRes.items ?? [])
      .filter((i) => i.market_value > 0)
      .map((i) => ({
        id: i.id,
        name: i.name,
        type: i.type,
        market_value: i.market_value,
        image: i.image,
      }));

    const listingsByItem: Record<number, MarketListing[]> = {};
    for (const entry of marketRes.itemmarket ?? []) {
      const listings = (entry.listings ?? [])
        .filter((l) => l.price > 0 && l.amount > 0)
        .map((l) => ({ price: l.price, amount: l.amount }));
      if (listings.length > 0) {
        listingsByItem[entry.id] = listings;
      } else if (entry.average_price && entry.average_price > 0) {
        listingsByItem[entry.id] = [{ price: entry.average_price, amount: 0 }];
      }
    }

    return {
      items,
      listingsByItem,
      countryStock: stock.countryStock,
      countryStockSource: stock.source,
    };
  });
