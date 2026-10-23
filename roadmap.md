# Roadmap

- [x] Add tested bazaar-offer ranking and profit calculations, limited by seller stock and travel slots.
- [ ] Connect TornW3B listings using the user's registered Torn key and documented seller fields.
- [ ] Add on-demand seller links, prices, quantities, freshness, and export profit to scanned items.

- [x] Correct Incorrect ID scan error, v2 response parsing, and destination feed parsing; regression tests pass. A live authenticated scan still requires the user's Torn key in the preview.

- [x] Export profit calculator (75% of foreign shop price, 100% for black market)
- [x] Torn API proxy (items + market listings) via server function
- [x] Destination picker: only rank items the selected country's shop stocks (YATA foreign-stock feed)
- [x] Results table UI (rank by profit, suitcase math, black market toggle)
- [x] Read Torn staff article (newspaper #2897) — confirmed export mechanics
- [x] Run tests, verify build, check preview
