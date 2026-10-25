# Roadmap

- [x] Add a combined item-market/bazaar shopping shortlist with chosen quantities, luggage limits, seller backups, freshness, and purchase/unavailable tracking.
- [x] Add conservative session request controls; 27 focused tests pass. Sample-scan flow verified with live TornW3B sellers, purchase/undo and unavailable controls without extra requests, and small-screen layout. Full real-key scan remains unverified.

- [x] Add tested bazaar-offer ranking and profit calculations, limited by seller stock and travel slots.
- [x] Connect TornW3B public listings without credentials; seller fields confirmed from live responses.
- [x] Add on-demand seller links, prices, quantities, freshness, and export profit to scanned items; live seller lookup and pagination verified using a sample Torn scan. Full scan with the user's real Torn key remains unverified.

- [x] Correct Incorrect ID scan error, v2 response parsing, and destination feed parsing; regression tests pass. A live authenticated scan still requires the user's Torn key in the preview.

- [x] Export profit calculator (75% of foreign shop price, 100% for black market)
- [x] Torn API proxy (items + market listings) via server function
- [x] Destination picker: only rank items the selected country's shop stocks (YATA foreign-stock feed)
- [x] Results table UI (rank by profit, suitcase math, black market toggle)
- [x] Read Torn staff article (newspaper #2897) — confirmed export mechanics
- [x] Run tests, verify build, check preview
