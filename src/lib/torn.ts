// Pure domain logic for the Torn export-profit tool.
// Rules from the user (Travel 3.0):
// - Regular items export for 75% of their NPC price (market_value).
// - Black market items export for 100% of their NPC price, and their
//   export price moves over time (mechanics unknown — treated as live value).

export interface TornItem {
  id: number;
  name: string;
  type: string;
  market_value: number;
  image?: string;
}

export interface MarketListing {
  price: number;
  amount: number;
}

export interface ExportRow {
  item: TornItem;
  blackMarket: boolean;
  exportPrice: number; // per unit, what the destination pays
  cheapestPrice: number | null; // cheapest market/bazaar listing
  cheapestAmount: number; // units available at cheapest price
  profitPerUnit: number | null;
  roiPct: number | null;
}

// Item types treated as black market by default. Users can toggle any row.
export const DEFAULT_BLACK_MARKET_TYPES = new Set(["Drug"]);

export function isBlackMarketDefault(item: Pick<TornItem, "type">): boolean {
  return DEFAULT_BLACK_MARKET_TYPES.has(item.type);
}

export function exportPriceFor(
  marketValue: number,
  blackMarket: boolean,
  standardRate = 0.75,
): number {
  const rate = blackMarket ? 1 : standardRate;
  return Math.floor(marketValue * rate);
}

export function buildExportRow(
  item: TornItem,
  listings: MarketListing[] | undefined,
  blackMarket: boolean,
  standardRate = 0.75,
): ExportRow {
  const exportPrice = exportPriceFor(item.market_value, blackMarket, standardRate);
  const cheapest = listings?.length
    ? listings.reduce((a, b) => (a.price <= b.price ? a : b))
    : null;

  const profitPerUnit = cheapest ? exportPrice - cheapest.price : null;
  const roiPct =
    cheapest && cheapest.price > 0
      ? ((exportPrice - cheapest.price) / cheapest.price) * 100
      : null;

  return {
    item,
    blackMarket,
    exportPrice,
    cheapestPrice: cheapest?.price ?? null,
    cheapestAmount: cheapest?.amount ?? 0,
    profitPerUnit,
    roiPct,
  };
}

export function rankByProfit(rows: ExportRow[]): ExportRow[] {
  return [...rows].sort((a, b) => (b.profitPerUnit ?? -Infinity) - (a.profitPerUnit ?? -Infinity));
}

export function formatMoney(n: number | null): string {
  if (n === null) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
}
