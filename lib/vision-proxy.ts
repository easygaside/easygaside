import Anthropic from "@anthropic-ai/sdk";
import type { AttachedImage } from "@/lib/chat-images";

/**
 * Vision proxy. The text-only codegen arms (DeepSeek V4 — no native vision via API) can't read an
 * attached reference image. So we have a vision model (Claude Haiku — cheap + multimodal) DESCRIBE
 * the images in Thai, then feed that description as plain text to the codegen model. The user keeps
 * a cheap text arm AND gets to attach UI mockups; the same pattern GitHub Copilot uses.
 *
 * Server-only. Best-effort: any failure returns null and the caller falls back to a "describe it in
 * text" nudge — a vision hiccup must never block the turn.
 */

// Haiku is multimodal and cheap; describing a mockup is a light, one-shot call.
const VISION_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 1200;

type AnthropicMedia = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/** Describe attached reference images as build-oriented Thai text, or null if it can't run. */
export async function describeImages(
  images: AttachedImage[],
  userMessage: string,
): Promise<string | null> {
  if (images.length === 0 || !process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic();
    const content: Anthropic.ContentBlockParam[] = [
      {
        type: "text",
        text:
          `ผู้ใช้แนบรูปอ้างอิง ${images.length} รูปเพื่อให้สร้างเครื่องมือ (มักเป็น mockup หน้าจอ/ฟอร์ม/ใบเอกสาร). ` +
          (userMessage ? `บริบทจากผู้ใช้: "${userMessage}". ` : "") +
          "บรรยายรูปแต่ละรูปอย่างละเอียดเชิงปฏิบัติเป็นภาษาไทย เพื่อให้ AI อีกตัวเอาไปสร้าง UI ได้ใกล้เคียง — " +
          "ระบุ: โครงหน้า/เลย์เอาต์, ฟิลด์และปุ่มทั้งหมด (พร้อมข้อความบนปุ่ม/ป้ายกำกับ), ตาราง+ชื่อคอลัมน์, " +
          "เมนู/แท็บ, โทนสีหลัก, และองค์ประกอบสำคัญอื่น ๆ. อย่าเดาเกินจากที่เห็นในรูป.",
      },
      ...images.map((img) => ({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: img.mediaType as AnthropicMedia,
          data: img.dataBase64,
        },
      })),
    ];
    const msg = await client.messages.create({
      model: VISION_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || null;
  } catch (e) {
    console.error("[vision-proxy] describe failed:", e);
    return null;
  }
}
