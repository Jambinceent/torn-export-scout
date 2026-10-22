// Normalized offers: provider-specific field mapping belongs in the server helper.
export interface BazaarOffer {
  sellerId: number;
  sellerName: string;
  price: number;
  quantity: number;
  updatedAt: number | null;
}

export interface RankedBazaarOffer extends BazaarOffer {
  profitPerUnit: number;
  purchasableQuantity: number;
  totalProfit: number;
}

export function rankBazaarOffers(
  offers: BazaarOffer[],
  exportPrice: number,
  slots: number,
): RankedBazaarOffer[] {
  const capacity = Number.isFinite(slots) ? Math.max(0, Math.floor(slots)) : 0;
  return offers
    .filter((offer) => Number.isSafeInteger(offer.sellerId) && offer.sellerId > 0
      && Number.isFinite(offer.price) && offer.price > 0
      && Number.isSafeInteger(offer.quantity) && offer.quantity > 0)
    .map((offer) => {
      const purchasableQuantity = Math.min(capacity, offer.quantity);
      const profitPerUnit = exportPrice - offer.price;
      return { ...offer, profitPerUnit, purchasableQuantity,
        totalProfit: profitPerUnit * purchasableQuantity };
    })
    .sort((a, b) => a.price - b.price || b.quantity - a.quantity);
}