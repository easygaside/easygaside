/**
 * Telegram Bot notifier — free (no per-message cost). Best-effort: a failure or missing config
 * never breaks the caller. Set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID to enable.
 *
 * Setup: message @BotFather → /newbot → copy the token. Get your chat id by messaging the bot once
 * then opening https://api.telegram.org/bot<TOKEN>/getUpdates and reading result[].message.chat.id
 * (or add the bot to a group/channel and use that chat id).
 */

const TELEGRAM_MAX = 4096;

export async function notifyTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return; // not configured → silently skip (report is still stored in DB)
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, TELEGRAM_MAX),
        disable_web_page_preview: true,
      }),
    });
  } catch (e) {
    console.error("[telegram] notify failed (non-fatal):", e);
  }
}
