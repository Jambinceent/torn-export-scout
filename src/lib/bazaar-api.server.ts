import type { BazaarOffer } from "./bazaar";

export interface BazaarPage {
  offers: BazaarOffer[];
  page: number;
  hasMore: boolean;
  generatedAt: number | null;
}

export function normalizeBazaarPage(payload: unknown, itemId: number, page: number): BazaarPage {
  if (!payload || typeof payload !== "object") throw new Error("TornW3B returned an unreadable response. Try again later.");
  const data = payload as Record<string, unknown>;
  if (data.item_id !== itemId || !Array.isArray(data.listings)) {
    throw new Error("TornW3B did not return listings for this item. Try again later.");
  }
  const offers: BazaarOffer[] = [];
  for (const entry of data.listings) {
    if (!entry || typeof entry !== "object") continue;
    const listing = entry as Record<string, unknown>;
    const { player_id, player_name, price, quantity, last_checked } = listing;
    if (listing.item_id !== itemId || typeof player_id !== "number" || !Number.isSafeInteger(player_id) || player_id <= 0
      || typeof price !== "number" || !Number.isFinite(price) || price <= 0
      || typeof quantity !== "number" || !Number.isSafeInteger(quantity) || quantity <= 0) continue;
    offers.push({ sellerId: player_id, sellerName: typeof player_name === "string" ? player_name : `Player ${player_id}`,
      price, quantity, updatedAt: typeof last_checked === "number" && Number.isFinite(last_checked) && last_checked > 0 ? last_checked : null });
  }
  return { offers, page, hasMore: data.has_more === true,
    generatedAt: typeof data.generated_at === "number" && Number.isFinite(data.generated_at) ? data.generated_at : null };
}

export async function scanBazaarItem(itemId: number, page = 1): Promise<BazaarPage> {
  const response = await fetch(`https://weav3r.dev/api/marketplace/${itemId}?page=${page}`, {
    headers: { accept: "application/json" }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    // No credentials are sent to this public feed.
    console.error(`TornW3B marketplace failed [${response.status}]: ${(await response.text()).slice(0, 1000)}`);
    if (response.status === 429) throw new Error("TornW3B's request limit was reached. Wait a minute before refreshing bazaars.");
    throw new Error(`TornW3B listings are unavailable (HTTP ${response.status}). Try again later.`);
  }
  return normalizeBazaarPage(await response.json(), itemId, page);
}