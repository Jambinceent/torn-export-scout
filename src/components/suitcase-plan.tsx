import { ExternalLink } from 'lucide-react';
import { freshness, type ShoppingLine } from '@/lib/shopping';
import { formatMoney } from '@/lib/torn';

export function SuitcasePlan({ lines, slots, progress, now }: { lines: ShoppingLine[]; slots: number; progress: string | null; now: number }) {
  const cost = lines.reduce((s, l) => s + l.price * l.buyQuantity, 0);
  const profit = lines.reduce((s, l) => s + l.profitPerUnit * l.buyQuantity, 0);
  const used = lines.reduce((s, l) => s + l.buyQuantity, 0);
  return <section aria-label="Where to buy" className="mb-8 rounded-lg border border-primary/40 bg-card p-4">
    <h2 className="text-lg font-semibold">Where to buy for maximum profit</h2>
    <p className="mb-3 text-xs text-muted-foreground">Checks bazaars for the top goods automatically. Stock isn't reserved — confirm in Torn before buying.</p>
    {progress && <p className="mb-3 text-sm text-muted-foreground">{progress}</p>}
    {lines.length === 0 ? <p className="text-sm text-muted-foreground">{progress ? 'Finding sellers…' : 'No profitable sellers found.'}</p> : <>
      <div className="mb-4 grid grid-cols-3 gap-4">
        <div><p className="text-xs text-muted-foreground">Total cost</p><p className="font-semibold">{formatMoney(cost)}</p></div>
        <div><p className="text-xs text-muted-foreground">Expected profit</p><p className="font-semibold text-chart-2">{formatMoney(profit)}</p></div>
        <div><p className="text-xs text-muted-foreground">Luggage</p><p className="font-semibold">{used} / {slots}</p></div>
      </div>
      <ol className="space-y-3">{lines.map((l, i) => {
        const age = l.source === 'bazaar' ? freshness(l.updatedAt, now) : { label: 'Item market (live scan)', stale: false };
        return <li key={l.key} className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-primary pl-3">
          <div className="min-w-0">
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4">{i + 1}. {l.sellerName}<ExternalLink className="size-3.5" /></a>
            <p className="text-sm">Buy {l.buyQuantity} × {l.itemName} at {formatMoney(l.price)} · <span className="text-chart-2">+{formatMoney(l.profitPerUnit * l.buyQuantity)}</span></p>
            <p className={`text-xs ${age.stale ? 'text-chart-3' : 'text-muted-foreground'}`}>{age.label}{age.stale ? ' · may be sold' : ''}</p>
          </div>
        </li>;
      })}</ol>
    </>}
  </section>;
}
