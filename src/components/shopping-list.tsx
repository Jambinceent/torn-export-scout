import { useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, RefreshCw, ShoppingBasket, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BazaarOffer } from '@/lib/bazaar';
import { combineOffers, freshness, planShopping, type Purchase, type ShoppingLine } from '@/lib/shopping';
import { formatMoney, type ExportRow, type MarketListing } from '@/lib/torn';

interface Props {
  rows: ExportRow[];
  listings: Record<number, MarketListing[]>;
  bazaars: Record<number, { offers: BazaarOffer[]; page: number; hasMore: boolean }>;
  slots: number;
  loadingItem: number | null;
  error: string | null;
  loadSellers: (itemId: number, page?: number) => Promise<void>;
}

export function ShoppingList({ rows, listings, bazaars, slots, loadingItem, error, loadSellers }: Props) {
  const [targets, setTargets] = useState<Record<number, number>>({});
  const [selected, setSelected] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<ShoppingLine | null>(null);
  const [boughtQuantity, setBoughtQuantity] = useState(1);
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const selectedRows = rows.filter(row => (targets[row.item.id] ?? 0) > 0);
  const offers = useMemo(() => Object.fromEntries(rows.map(row => [row.item.id,
    combineOffers(row.item.id, listings[row.item.id] ?? [], bazaars[row.item.id]?.offers ?? [])])), [rows, listings, bazaars]);
  const lines = planShopping(selectedRows, targets, offers, purchases, unavailable, slots);
  const spent = purchases.reduce((sum, p) => sum + p.price * p.buyQuantity, 0);
  const plannedCost = lines.reduce((sum, p) => sum + p.price * p.buyQuantity, 0);
  const estimatedProfit = [...lines, ...purchases].reduce((sum, p) => sum + p.profitPerUnit * p.buyQuantity, 0);
  const boughtSlots = purchases.reduce((sum, p) => sum + p.buyQuantity, 0);
  const plannedSlots = lines.reduce((sum, p) => sum + p.buyQuantity, 0);

  function confirmPurchase() {
    if (!confirming || !Number.isSafeInteger(boughtQuantity) || boughtQuantity <= 0 || boughtQuantity > confirming.buyQuantity) return;
    setPurchases(previous => [...previous, { ...confirming, buyQuantity: boughtQuantity, purchaseId: Date.now() }]);
    setConfirming(null);
  }

  return <section aria-label="Combined shopping list" className="mb-8 border-y border-border py-6">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><ShoppingBasket className="size-5" />Combined shopping list</h2>
      {selectedRows.length > 0 && <Button variant="ghost" size="sm" onClick={() => { setTargets({}); setPurchases([]); setUnavailable(new Set()); setConfirming(null); }}>Clear list</Button>}
    </div>
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm"><span>Export item</span>
        <select aria-label="Shopping item" value={selected} onChange={e => setSelected(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2">
          <option value="">Choose an item</option>
          {rows.map(row => <option key={row.item.id} value={row.item.id}>{row.item.name} — pays {formatMoney(row.exportPrice)}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm"><span>Quantity</span><input aria-label="Shopping quantity" type="number" min={1} max={slots} value={quantity}
        onChange={e => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))} className="w-24 rounded-md border border-input bg-background px-3 py-2" /></label>
      <Button disabled={!selected} onClick={() => {
        const id = Number(selected);
        if (!rows.some(row => row.item.id === id)) return;
        setTargets(previous => ({ ...previous, [id]: (previous[id] ?? 0) + Math.min(quantity, slots) }));
        setSelected('');
      }}>Add to list</Button>
    </div>
    {selectedRows.length === 0 ? <p className="text-sm text-muted-foreground">No goods selected.</p> : <>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div><p className="text-xs text-muted-foreground">Remaining shopping cost</p><p className="font-semibold">{formatMoney(plannedCost)}</p></div>
        <div><p className="text-xs text-muted-foreground">Confirmed spending</p><p className="font-semibold">{formatMoney(spent)}</p></div>
        <div><p className="text-xs text-muted-foreground">Estimated export profit</p><p className="font-semibold text-chart-2">{formatMoney(estimatedProfit)}</p></div>
        <div><p className="text-xs text-muted-foreground">Luggage</p><p className="font-semibold">{boughtSlots} bought + {plannedSlots} planned / {slots}</p></div>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">Stock is not reserved. Confirm price and availability in Torn before buying. Black-market payouts may change before arrival.</p>
      {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
      {selectedRows.map(row => {
        const itemLines = lines.filter(line => line.itemId === row.item.id);
        const bought = purchases.filter(p => p.itemId === row.item.id).reduce((sum, p) => sum + p.buyQuantity, 0);
        const planned = itemLines.reduce((sum, p) => sum + p.buyQuantity, 0);
        const missing = Math.max(0, (targets[row.item.id] ?? 0) - bought - planned);
        const itemOffers = offers[row.item.id] ?? [];
        const backups = itemOffers.filter(offer => !unavailable.has(offer.key) && offer.price < row.exportPrice && !itemLines.some(line => line.key === offer.key)
          && offer.quantity > purchases.filter(p => p.key === offer.key).reduce((sum, p) => sum + p.buyQuantity, 0));
        return <div key={row.item.id} className="border-t border-border py-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="font-semibold">{row.item.name}</h3><p className="text-xs text-muted-foreground">{targets[row.item.id]} wanted · {bought} bought · {planned} planned · pays {formatMoney(row.exportPrice)} each</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" disabled={loadingItem !== null} onClick={() => void loadSellers(row.item.id)}>
                <RefreshCw className="size-3.5" />{loadingItem === row.item.id ? 'Loading…' : bazaars[row.item.id] ? 'Refresh sellers' : 'Find sellers'}
              </Button>
              {bazaars[row.item.id]?.hasMore && <Button size="sm" variant="outline" disabled={loadingItem !== null} onClick={() => void loadSellers(row.item.id, (bazaars[row.item.id]?.page ?? 1) + 1)}>More sellers</Button>}
              <Button size="icon" variant="ghost" aria-label={`Remove ${row.item.name}`} title="Remove item" onClick={() => { setTargets(prev => ({ ...prev, [row.item.id]: 0 })); setConfirming(null); }} disabled={bought > 0}><X className="size-4" /></Button>
            </div>
          </div>
          {missing > 0 && <p className="mb-3 text-sm text-chart-3">{missing} units unfilled — limited by luggage space, profitable stock, or the per-item sales cap.</p>}
          <div className="space-y-3">
            {itemLines.map(line => {
              const age = line.source === 'bazaar' ? freshness(line.updatedAt, now) : { label: 'From latest market scan', stale: false };
              return <div key={line.key} className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-border pl-3">
                <div className="min-w-0"><a className="inline-flex max-w-full items-center gap-1 break-all font-medium text-primary underline underline-offset-4" href={line.url} target="_blank" rel="noopener noreferrer">{line.sellerName}<ExternalLink className="size-3.5 shrink-0" /></a>
                  <p className="text-sm">Buy {line.buyQuantity} × {formatMoney(line.price)} · cost {formatMoney(line.buyQuantity * line.price)} · <span className="text-chart-2">profit {formatMoney(line.buyQuantity * line.profitPerUnit)}</span></p>
                  <p className={`text-xs ${age.stale ? 'text-chart-3' : 'text-muted-foreground'}`}>{age.label}{age.stale ? ' · Confirm stock' : ''}</p>
                </div>
                <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => { setConfirming(line); setBoughtQuantity(line.buyQuantity); }}><Check className="size-4" />Bought</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setUnavailable(prev => new Set([...prev, line.key])); setConfirming(null); }}><X className="size-4" />Unavailable</Button></div>
              </div>;
            })}
          </div>
          {backups.length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer text-muted-foreground">{backups.length} backup offers</summary>
            <ul className="mt-2 space-y-2">{backups.map(offer => <li key={offer.key} className="flex flex-wrap gap-x-3 gap-y-1"><a href={offer.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{offer.sellerName} ↗</a><span>{formatMoney(offer.price)} / unit</span><span className="text-muted-foreground">{offer.source === 'bazaar' ? freshness(offer.updatedAt, now).label : 'From latest market scan'}</span></li>)}</ul>
          </details>}
        </div>;
      })}
      {confirming && <div role="group" aria-label="Confirm purchase" className="my-4 flex flex-wrap items-end gap-3 border-y border-border py-4">
        <label className="flex flex-col gap-1 text-sm"><span>Units bought from {confirming.sellerName} at {formatMoney(confirming.price)} each</span><input aria-label="Units actually bought" type="number" min={1} max={confirming.buyQuantity} value={boughtQuantity} onChange={e => setBoughtQuantity(Number(e.target.value))} className="w-24 rounded-md border border-input bg-background px-3 py-2" /></label>
        <Button disabled={!Number.isSafeInteger(boughtQuantity) || boughtQuantity < 1 || boughtQuantity > confirming.buyQuantity} onClick={confirmPurchase}>Confirm purchase</Button><Button variant="ghost" onClick={() => setConfirming(null)}>Cancel</Button>
      </div>}
      {purchases.length > 0 && <div className="mt-4 border-t border-border pt-3"><h3 className="mb-2 text-sm font-semibold">Confirmed purchases</h3>{purchases.map(p => <div key={p.purchaseId} className="flex flex-wrap items-center justify-between gap-2 py-1 text-sm"><span>{p.buyQuantity} × {p.itemName} · {p.sellerName} · {formatMoney(p.price * p.buyQuantity)}</span><Button size="icon" variant="ghost" aria-label={`Undo purchase of ${p.itemName}`} title="Undo purchase" onClick={() => setPurchases(prev => prev.filter(other => other.purchaseId !== p.purchaseId))}><Undo2 className="size-4" /></Button></div>)}</div>}
      {unavailable.size > 0 && <Button className="mt-3" size="sm" variant="ghost" onClick={() => setUnavailable(new Set())}><Undo2 className="size-4" />Restore unavailable offers</Button>}
    </>}
  </section>;
}