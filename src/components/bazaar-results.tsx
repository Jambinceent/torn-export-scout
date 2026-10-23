import { rankBazaarOffers, type BazaarOffer } from "@/lib/bazaar";
import { formatMoney } from "@/lib/torn";

export function BazaarResults({ offers, exportPrice, slots }: {
  offers: BazaarOffer[]; exportPrice: number; slots: number;
}) {
  const ranked = rankBazaarOffers(offers, exportPrice, slots);
  if (!ranked.length) return <p className="py-3 text-sm text-muted-foreground">No stocked bazaar listings found for this item.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 pr-4">Seller</th>
            <th className="px-3 py-2 text-right">Price / unit</th>
            <th className="px-3 py-2 text-right">Stock</th>
            <th className="px-3 py-2 text-right">Profit / unit</th>
            <th className="px-3 py-2 text-right">Buy up to</th>
            <th className="px-3 py-2 text-right">Total profit</th>
            <th className="px-3 py-2">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((offer) => (
            <tr key={offer.sellerId} className="border-b border-border/50 last:border-0">
              <td className="py-2 pr-4">
                <a href={`https://www.torn.com/bazaar.php?userID=${offer.sellerId}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-4">
                  {offer.sellerName} [{offer.sellerId}] ↗
                </a>
              </td>
              <td className="px-3 py-2 text-right">{formatMoney(offer.price)}</td>
              <td className="px-3 py-2 text-right">{offer.quantity.toLocaleString()}</td>
              <td className={`px-3 py-2 text-right ${offer.profitPerUnit > 0 ? "text-chart-2" : "text-destructive"}`}>{formatMoney(offer.profitPerUnit)}</td>
              <td className="px-3 py-2 text-right">{offer.purchasableQuantity}</td>
              <td className={`px-3 py-2 text-right ${offer.totalProfit > 0 ? "text-chart-2" : "text-destructive"}`}>{formatMoney(offer.totalProfit)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{offer.updatedAt === null ? "Unknown" : new Date(offer.updatedAt * 1000).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}