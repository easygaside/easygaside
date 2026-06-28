/**
 * Best-effort Discord notification via an incoming webhook (DISCORD_WEBHOOK_URL).
 * Never throws — a notification failure must not break the user-facing flow that triggered it.
 */
export async function notifyDiscord(content: string): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  } catch (e) {
    console.error("[discord] notify failed:", e);
  }
}
