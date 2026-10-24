<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep Torn API request/parsing logic in the server-only helper, with the server function returning recoverable scan errors as data so users see actionable errors.
- Scan item-market listings per item ID and only for the selected destination’s stock; this respects Torn’s per-item API contract and avoids unnecessary requests.
- Normalize bazaar provider responses server-side before passing them to the pure offer-ranking helper; this keeps provider fields and credentials separate from profit calculations.
- Fetch TornW3B's public marketplace pages on demand for scanned items without credentials; this avoids exposing keys or spending requests on unselected goods.
- Keep combined shopping allocation pure and session-only, sharing already fetched offers with seller tables; tracking purchases must not trigger provider calls or imply stock reservations.
- Guard every UI bazaar request with a shared session limiter and single in-flight lock; conservative local limits reduce request usage but do not claim to enforce the provider's unknown shared anonymous quota.
