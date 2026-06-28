/**
 * Start of the current calendar month in Asia/Bangkok (UTC+7, no DST), as a UTC ISO instant.
 * Monthly quotas (the credit pool, the new-tool count) reset at THAI midnight on the 1st — not UTC
 * midnight — so a user's month flips when their calendar does. Shared by lib/energy + lib/beta.
 */
const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

export function bangkokMonthStartISO(): string {
  // shift "now" by +7h so getUTC* reads the Bangkok wall clock, take its year/month,
  // then express Thai-midnight-of-the-1st back as a UTC instant (7h before UTC midnight).
  const bkk = new Date(Date.now() + BKK_OFFSET_MS);
  return new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), 1) - BKK_OFFSET_MS).toISOString();
}
