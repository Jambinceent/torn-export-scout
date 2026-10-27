import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { BazaarResults } from "@/components/bazaar-results";
import { SuitcasePlan } from "@/components/suitcase-plan";
import { BazaarRequestGuard, combineOffers, recommendSuitcase } from "@/lib/shopping";
import { fetchBazaarItem } from "@/lib/bazaar.functions";
import type { BazaarOffer } from "@/lib/bazaar";

import { fetchTornMarket, type TornMarketData } from "../lib/torn.functions";
import {
  COUNTRIES,
  buildExportRow,
  formatMoney,
  isBlackMarketDefault,
  rankByProfit,
  type ExportRow,
} from "../lib/torn";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Torn Export Profit Calculator — Travel 3.0" },
      {
        name: "description",
        content:
          "See which goods are most profitable to export abroad in Torn's Travel 3.0: live market and bazaar prices vs. what foreign shops pay (75% of shop price, 100% for black market).",
      },
      { property: "og:title", content: "Torn Export Profit Calculator — Travel 3.0" },
      {
        property: "og:description",
        content:
          "Rank goods by export profit per trip: live Torn market prices vs. foreign shop buy-back rates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const API_KEY_STORAGE = "torn-export-api-key";

function Index() {
  const [apiKey, setApiKey] = useState("");
  const fetchMarket = useServerFn(fetchTornMarket);
  const fetchBazaars = useServerFn(fetchBazaarItem);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [bazaarLoading, setBazaarLoading] = useState<number | null>(null);
  const [bazaarError, setBazaarError] = useState<string | null>(null);
  const [bazaarPages, setBazaarPages] = useState<Record<number, { offers: BazaarOffer[]; page: number; hasMore: boolean }>>({});
  const bazaarGuard = useRef(new BazaarRequestGuard());
  const bazaarBusy = useRef(false);
  const [scanVersion, setScanVersion] = useState(0);
  useEffect(() => {
    setApiKey(window.localStorage.getItem(API_KEY_STORAGE) ?? "");
  }, []);
  const [country, setCountry] = useState("jap");
  const [ratePct, setRatePct] = useState(75);
  const [slots, setSlots] = useState(20);
  const [data, setData] = useState<TornMarketData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bmOverrides, setBmOverrides] = useState<Record<number, boolean>>({});
  const [hideLosses, setHideLosses] = useState(true);

  async function scan() {
    setScanVersion(previous => previous + 1);
    setExpandedItem(null);
    setBazaarPages({});
    setBazaarError(null);
    setLoading(true);
    setError(null);
    try {
      window.localStorage.setItem(API_KEY_STORAGE, apiKey);
      const result = await fetchMarket({ data: { apiKey, country } });
      if (result.error) setError(result.error);
      setData(result.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function loadBazaars(itemId: number, page = 1) {
    if (bazaarBusy.current) return;
    setExpandedItem(itemId);
    const blocked = bazaarGuard.current.reserve(Date.now());
    if (blocked) { setBazaarError(blocked); return; }
    bazaarBusy.current = true;
    setBazaarLoading(itemId);
    setBazaarError(null);
    try {
      const result = await fetchBazaars({ data: { itemId, page } });
      if (result.error) {
        setBazaarError(result.error);
        if (/limit|429/i.test(result.error)) bazaarGuard.current.pause(Date.now());
      }
      if (result.data) {
        const next = result.data;
        setBazaarPages((previous) => ({ ...previous, [itemId]: {
          ...next, offers: page === 1 ? next.offers : [...(previous[itemId]?.offers ?? []), ...next.offers],
        } }));
      }
    } catch {
      setBazaarError("Could not reach TornW3B. Try again later.");
    } finally {
      bazaarBusy.current = false;
      setBazaarLoading(null);
    }
  }

  const rows = useMemo<ExportRow[]>(() => {
    if (!data) return [];
    const stock = data.countryStock[country] ?? [];
    const stockById = new Map(stock.map((s) => [s.itemId, s]));
    const rate = ratePct / 100;

    const exportable = data.items.filter((item) => {
      if (data.countryStockSource === "yata") return stockById.has(item.id);
      return true; // no country feed: fall back to all items
    });

    return rankByProfit(
      exportable.map((item) => {
        const blackMarket = bmOverrides[item.id] ?? isBlackMarketDefault(item);
        const foreignPrice = stockById.get(item.id)?.price ?? item.market_value;
        return buildExportRow(item, foreignPrice, data.listingsByItem[item.id], blackMarket, rate);
      }),
    );
  }, [data, country, ratePct, bmOverrides]);

  const [autoProgress, setAutoProgress] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  // After each scan, check bazaars for the top 5 profitable goods only (5 TornW3B calls, 3s apart).
  const topIds = rows.filter((r) => (r.profitPerUnit ?? -1) > 0).slice(0, 5).map((r) => r.item.id).join(",");
  useEffect(() => {
    if (!topIds) return;
    let cancelled = false;
    const ids = topIds.split(",").map(Number);
    void (async () => {
      for (let i = 0; i < ids.length && !cancelled; i++) {
        setAutoProgress(`Checking bazaars ${i + 1} of ${ids.length}…`);
        while (!cancelled && bazaarGuard.current.reserve(Date.now()) !== null) {
          if (bazaarError && /limit|cooling|daily/i.test(bazaarError)) { cancelled = true; break; }
          await new Promise((r) => setTimeout(r, 1000));
        }
        if (cancelled) break;
        try {
          const result = await fetchBazaars({ data: { itemId: ids[i]!, page: 1 } });
          if (result.error) { setBazaarError(result.error); if (/limit|429/i.test(result.error)) { bazaarGuard.current.pause(Date.now()); break; } }
          const page = result.data;
          if (page && !cancelled) setBazaarPages((prev) => ({ ...prev, [ids[i]!]: page }));
        } catch { setBazaarError("Could not reach TornW3B. Try again later."); }
      }
      if (!cancelled) setAutoProgress(null);
    })();
    return () => { cancelled = true; setAutoProgress(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topIds, scanVersion]);
  const plan = useMemo(() => recommendSuitcase(rows, Object.fromEntries(rows.map((r) => [r.item.id,
    combineOffers(r.item.id, data?.listingsByItem[r.item.id] ?? [], bazaarPages[r.item.id]?.offers ?? [])])), slots),
    [rows, data, bazaarPages, slots]);

  const visibleRows = hideLosses ? rows.filter((r) => (r.profitPerUnit ?? -1) > 0) : rows;
  const best = visibleRows[0] ?? null;
  const suitcaseProfit = best?.profitPerUnit ? best.profitPerUnit * slots : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Torn Export Profit Calculator
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Travel 3.0 lets you sell goods to foreign shops: they buy back what
            they stock — black market goods (drugs) at their current
            fluctuating price, everything else at 75% of the shop's sell price.
            This tool compares those payouts against the cheapest live market
             listings in Torn’s item market and TornW3B player bazaars.
          </p>
        </header>

        <section className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">Torn API key (Public access)</span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your API key (stored only in your browser)"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Standard buy-back %</span>
              <input
                type="number"
                min={1}
                max={100}
                value={ratePct}
                onChange={(e) => setRatePct(Number(e.target.value) || 75)}
                className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Travel slots</span>
              <input
                type="number"
                min={1}
                max={99}
                value={slots}
                onChange={(e) => setSlots(Number(e.target.value) || 1)}
                className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <Button
              onClick={scan}
              disabled={loading || bazaarLoading !== null || !apiKey.trim()}
              className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Scanning market…" : "Scan market"}
            </Button>
          </div>
          {error && (
            <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Destination
          </h2>
          <div className="flex flex-wrap gap-2">
            {COUNTRIES.map((c) => (
              <Button
                key={c.code}
                disabled={loading || bazaarLoading !== null}
                onClick={() => { setCountry(c.code); setData(null); setError(null); setExpandedItem(null); setBazaarPages({}); setBazaarError(null); }}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  country === c.code
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-card-foreground hover:bg-accent"
                }`}
              >
                {c.flag} {c.name}
              </Button>
            ))}
          </div>
          {data && data.countryStockSource === "none" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Live foreign-stock feed unavailable — showing all items. Export
              prices then fall back to Torn NPC values.
            </p>
          )}
        </section>

        {data && best && (
          <section className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Best export right now
              </p>
              <p className="mt-1 text-lg font-bold">{best.item.name}</p>
              <p className="text-sm text-chart-2">
                {formatMoney(best.profitPerUnit)} profit / unit
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Full travel inventory ({slots} slots)
              </p>
              <p className="mt-1 text-lg font-bold text-chart-2">
                {formatMoney(suitcaseProfit)}
              </p>
              <p className="text-sm text-muted-foreground">
                if filled with {best.item.name}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Profitable goods in {COUNTRIES.find((c) => c.code === country)?.name}
              </p>
              <p className="mt-1 text-lg font-bold">{visibleRows.length}</p>
              <p className="text-sm text-muted-foreground">
                of {rows.length} exportable items
              </p>
            </div>
          </section>
        )}

        {data && rows.length > 0 && <SuitcasePlan lines={plan} slots={slots} progress={autoProgress} now={now} />}

        {data && (
          <section className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">
                Export rankings — {COUNTRIES.find((c) => c.code === country)?.name}
              </h2>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={hideLosses}
                  onChange={(e) => setHideLosses(e.target.checked)}
                  className="accent-current"
                />
                Hide losing items
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2 text-right">Shop price</th>
                    <th className="px-4 py-2 text-right">Export pays</th>
                    <th className="px-4 py-2 text-right">Item market</th>
                    <th className="px-4 py-2 text-right">Profit / unit</th>
                    <th className="px-4 py-2 text-right">ROI</th>
                    <th className="px-4 py-2 text-center">Black mkt</th>
                    <th className="px-4 py-2">Bazaars</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.slice(0, 100).map((row, i) => (
                    <Fragment key={row.item.id}>
                    <tr
                      className="border-b border-border/50 last:border-0 hover:bg-accent/50"
                    >
                      <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2 font-medium">{row.item.name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{row.item.type}</td>
                      <td className="px-4 py-2 text-right">{formatMoney(row.foreignPrice)}</td>
                      <td className="px-4 py-2 text-right">{formatMoney(row.exportPrice)}</td>
                      <td className="px-4 py-2 text-right">
                        {formatMoney(row.cheapestPrice)}
                        {row.cheapestAmount > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ×{row.cheapestAmount}
                          </span>
                        )}
                      </td>
                      <td
                        className={`px-4 py-2 text-right font-semibold ${
                          (row.profitPerUnit ?? 0) > 0 ? "text-chart-2" : "text-destructive"
                        }`}
                      >
                        {formatMoney(row.profitPerUnit)}
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {row.roiPct === null ? "—" : `${row.roiPct.toFixed(0)}%`}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.blackMarket}
                          onChange={(e) =>
                            setBmOverrides((prev) => ({
                              ...prev,
                              [row.item.id]: e.target.checked,
                            }))
                          }
                          className="accent-current"
                          title="Black market goods are bought back at 100% of the current foreign price"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Button size="sm" variant="outline" disabled={bazaarLoading !== null}
                          onClick={() => {
                            setBazaarError(null);
                            if (expandedItem === row.item.id) setExpandedItem(null);
                            else if (bazaarPages[row.item.id]) setExpandedItem(row.item.id);
                            else void loadBazaars(row.item.id);
                          }}>
                          {bazaarLoading === row.item.id ? "Loading…" : expandedItem === row.item.id ? "Hide sellers" : "Find sellers"}
                        </Button>
                      </td>
                    </tr>
                    {expandedItem === row.item.id && (
                      <tr className="border-b border-border bg-muted/30">
                        <td colSpan={10} className="px-4 py-4">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-semibold">{row.item.name} — TornW3B bazaars</h3>
                            <Button size="sm" variant="outline" disabled={bazaarLoading !== null} onClick={() => void loadBazaars(row.item.id)}>Refresh sellers</Button>
                          </div>
                          <p className="mb-3 text-xs text-muted-foreground">Export pays {formatMoney(row.exportPrice)} / unit. Listings may change before you buy; confirm stock and price in the seller’s bazaar.</p>
                          {bazaarError && <p role="alert" className="mb-3 text-sm text-destructive">{bazaarError}</p>}
                          {bazaarPages[row.item.id] && <BazaarResults offers={bazaarPages[row.item.id]?.offers ?? []} exportPrice={row.exportPrice} slots={slots} />}
                          {bazaarLoading === row.item.id && <p role="status" className="py-2 text-sm text-muted-foreground">Loading bazaar listings…</p>}
                          {bazaarPages[row.item.id]?.hasMore && <Button className="mt-3" size="sm" variant="outline" disabled={bazaarLoading !== null}
                            onClick={() => void loadBazaars(row.item.id, (bazaarPages[row.item.id]?.page ?? 1) + 1)}>More sellers</Button>}
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                  {visibleRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                        No profitable exports found for this destination right now.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!data && !loading && (
          <p className="text-center text-sm text-muted-foreground">
            Paste your Torn API key and hit <strong>Scan market</strong> to see
             export rankings for the selected destination. Your key is sent through
             this app’s server to Torn and is not saved on the server.
          </p>
        )}

        <footer className="mt-8 text-xs text-muted-foreground">
          <p>
            Rules per the Torn staff Travel Phase 3 announcement: foreign shops
            buy back only items they stock; black market goods at their current
            (fluctuating) price; all other items at 75% of the shop's sell
            price. Weapons and armor sales are capped at 100 per type per trip.
            Black market prices move during the day — re-scan before you fly.
          </p>
        </footer>
      </div>
    </div>
  );
}
