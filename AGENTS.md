# AGENTS.md

COURT-GRABBER books real tennis courts with real credentials (see `README.md`
for the `.env` keys).

- Never run `index.ts` or `bun run start` to "test" a change. Every run can make
  or attempt a real reservation. Run it only when the user asks for a booking.
- Verify changes with `bunx tsc --noEmit` instead. There are no tests.
