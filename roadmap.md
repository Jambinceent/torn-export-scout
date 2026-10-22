# Roadmap

- [ ] Add TornW3B bazaar offers for scanned items, including seller links, prices, quantities, and export profit; confirm API access before implementation.

- [x] Correct Incorrect ID scan error, v2 response parsing, and destination feed parsing; regression tests pass. A live authenticated scan still requires the user's Torn key in the preview.

- [x] Export profit calculator (75% of foreign shop price, 100% for black market)
- [x] Torn API proxy (items + market listings) via server function
- [x] Destination picker: only rank items the selected country's shop stocks (YATA foreign-stock feed)
- [x] Results table UI (rank by profit, suitcase math, black market toggle)
- [x] Read Torn staff article (newspaper #2897) — confirmed export mechanics
- [x] Run tests, verify build, check preview
