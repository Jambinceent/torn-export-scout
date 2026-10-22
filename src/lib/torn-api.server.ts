import { COUNTRIES, type ForeignStockEntry, type MarketListing, type TornItem } from "./torn";

interface ApiItem {
  id: number;
  name: string;
  type: string;
  image?: string;
  value: { market_price: number };
}

interface StockItem {
  id: number;
  cost: number;
  quantity?: number;
}

async function readTorn<T>(path: string, apiKey: string): Promise<T> {
  const response = await fetch(`https://api.torn.com/v2/${path}`, {
    headers: { accept: "application/json", Authorization: `ApiKey ${apiKey}` },
  });
  if (!response.ok) throw new Error(`Torn is unavailable (HTTP ${response.status}). Try again shortly.`);
  const result = await response.json() as T & { error?: { code: number; error: string } };
  if (result.error) {
    const { code } = result.error;
    if (code === 2) throw new Error("Torn rejected this key. Check that it is an active Torn API key.");
    if (code === 16) throw new Error("This key needs Public access, including torn.items and market.itemmarket.");
    if (code === 5) throw new Error("Torn's request limit was reached. Wait one minute before scanning again.");
    throw new Error(`Torn API error ${code}: ${result.error.error}`);
  }
  return result;
}

export async function scanTornMarket(apiKey: string, country: string) {
  if (!COUNTRIES.some((entry) => entry.code === country)) throw new Error("Choose a supported destination.");
  const [catalog, feed] = await Promise.all([
    readTorn<{ items: ApiItem[] }>("torn/items", apiKey),
    fetch("https://yata.yt/api/v1/travel/export/", { headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Stock feed unavailable");
        return await response.json() as { stocks?: Record<string, { stocks?: StockItem[] }> };
      })
      .catch(() => null),
  ]);
  const stock = feed?.stocks?.[country]?.stocks;
  if (!stock?.length) {
    throw new Error("Destination shop prices are unavailable. Try again later; no estimated export prices are used.");
  }
  const countryStock: Record<string, ForeignStockEntry[]> = {
    [country]: stock.filter((entry) => entry.cost > 0).map((entry) => ({
      itemId: entry.id, price: entry.cost, quantity: entry.quantity ?? null,
    })),
  };
  const ids = new Set(countryStock[country]?.map((entry) => entry.itemId));
  const items: TornItem[] = catalog.items.filter((entry) => ids.has(entry.id)).map((entry) => ({
    id: entry.id, name: entry.name, type: entry.type,
    market_value: entry.value.market_price, image: entry.image,
  }));
  const listingsByItem: Record<number, MarketListing[]> = {};
  // Small batches avoid overwhelming Torn; only scan goods sold at this destination.
  for (let offset = 0; offset < items.length; offset += 3) {
    await Promise.all(items.slice(offset, offset + 3).map(async (item) => {
      const result = await readTorn<{ itemmarket: { listings: MarketListing[] } }>(
        `market/${item.id}/itemmarket?limit=100`, apiKey,
      );
      listingsByItem[item.id] = (result.itemmarket.listings ?? [])
        .filter((listing) => listing.price > 0 && listing.amount > 0)
        .map(({ price, amount }) => ({ price, amount }));
    }));
  }
  return { items, listingsByItem, countryStock, countryStockSource: "yata" as const };
}