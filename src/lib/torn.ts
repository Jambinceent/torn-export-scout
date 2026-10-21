// Pure domain logic for the Torn export-profit tool.
// Rules confirmed from the Torn staff article (newspaper #2897, Travel Phase 3):
// - Foreign shops buy back only the items they sell themselves.
// - Black market goods (drugs) are bought back at their current foreign
//   price, which fluctuates throughout the day.
// - All other items are bought back at 75% of the foreign shop's standard
//   sell price.
// - Weapons/armor sales are capped at 100 per type per trip; drugs uncapped
//   (limited only by travel inventory slots).

export interface TornItem {
  id: number;
  name: string;
  type: string;
  market_value: number;
  image?: string | undefined;
}

export interface MarketListing {
  price: number;
  amount: number;
}

export interface Country {
  code: string;
  name: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: "mex", name: "Mexico", flag: "🇲🇽" },
  { code: "cay", name: "Cayman Islands", flag: "🇰🇾" },
  { code: "can", name: "Canada", flag: "🇨🇦" },
  { code: "haw", name: "Hawaii", flag: "🌺" },
  { code: "uni", name: "United Kingdom", flag: "🇬🇧" },
  { code: "arg", name: "Argentina", flag: "🇦🇷" },
  { code: "swi", name: "Switzerland", flag: "🇨🇭" },
  { code: "jap", name: "Japan", flag: "🇯🇵" },
  { code: "chi", name: "China", flag: "🇨🇳" },
  { code: "uae", name: "UAE", flag: "🇦🇪" },
  { code: "sou", name: "South Africa", flag: "🇿🇦" },
];

// An item a foreign shop stocks, with its current foreign sell price.
export interface ForeignStockEntry {
  itemId: number;
  price: number; // the foreign shop's current sell price
  quantity: number | null;
}

export interface ExportRow {
  item: TornItem;
  blackMarket: boolean;
  foreignPrice: number; // what the foreign shop sells it for
  exportPrice: number; // per unit, what the destination pays you
  cheapestPrice: number | null; // cheapest Torn market/bazaar listing
  cheapestAmount: number; // units available at cheapest price
  profitPerUnit: number | null;
  roiPct: number | null;
}

// Drugs are the black market goods per the staff article.
export const DEFAULT_BLACK_MARKET_TYPES = new Set(["Drug"]);

export function isBlackMarketDefault(item: Pick<TornItem, "type">): boolean {
  return DEFAULT_BLACK_MARKET_TYPES.has(item.type);
}

// Black market: 100% of current foreign price. Everything else: 75% of the
// foreign shop's standard sell price.
export function exportPriceFor(
  foreignPrice: number,
  blackMarket: boolean,
  standardRate = 0.75,
): number {
  const rate = blackMarket ? 1 : standardRate;
  return Math.floor(foreignPrice * rate);
}

export function buildExportRow(
  item: TornItem,
  foreignPrice: number,
  listings: MarketListing[] | undefined,
  blackMarket: boolean,
  standardRate = 0.75,
): ExportRow {
  const exportPrice = exportPriceFor(foreignPrice, blackMarket, standardRate);
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
    foreignPrice,
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
