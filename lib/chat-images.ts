import { createServiceClient } from "@/lib/supabase/service";

/**
 * Chat image attachments (server-only). The client compresses images and sends them as base64;
 * we persist each to a private storage bucket and record a row so the files can be cascade-removed
 * when the project is deleted. The same base64 is fed to the model for the turn it was attached.
 *
 * History note: we deliberately do NOT keep the image blocks in egs_messages — they'd be re-sent
 * to the model (and re-billed as image tokens) on every later turn. The model sees the images once;
 * the bucket keeps them as the project's reference history.
 */

export const CHAT_IMAGES_BUCKET = "egs-chat-images";
export const MAX_CHAT_IMAGES = 4;

/** Allowed by the Anthropic image API (and the bucket's allowed_mime_types). */
const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export interface AttachedImage {
  /** raw base64 (no data: prefix) */
  dataBase64: string;
  mediaType: string;
}

/** Validate + clamp an incoming attachment list from an untrusted request body. */
export function parseAttachedImages(raw: unknown): AttachedImage[] {
  if (!Array.isArray(raw)) return [];
  const out: AttachedImage[] = [];
  for (const item of raw.slice(0, MAX_CHAT_IMAGES)) {
    if (!item || typeof item !== "object") continue;
    const mediaType = String((item as Record<string, unknown>).mediaType ?? "");
    let data = String((item as Record<string, unknown>).dataBase64 ?? "");
    // tolerate a full data URL
    const comma = data.indexOf(",");
    if (data.startsWith("data:") && comma !== -1) data = data.slice(comma + 1);
    if (!ALLOWED_MEDIA.has(mediaType) || data.length === 0) continue;
    out.push({ dataBase64: data, mediaType });
  }
  return out;
}

/**
 * Upload attachments to the private bucket and record them. Best-effort: a storage failure is
 * logged but never blocks the chat turn (the model still receives the images in-memory).
 * Caller MUST have verified project ownership.
 */
export async function storeChatImages(projectId: string, images: AttachedImage[]): Promise<void> {
  if (images.length === 0) return;
  const svc = createServiceClient();
  const stamp = Date.now();
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    try {
      const bytes = Buffer.from(img.dataBase64, "base64");
      const ext = EXT[img.mediaType] ?? "bin";
      const path = `${projectId}/${stamp}-${i}.${ext}`;
      const up = await svc.storage
        .from(CHAT_IMAGES_BUCKET)
        .upload(path, bytes, { contentType: img.mediaType, upsert: false });
      if (up.error) {
        console.error("[chat-images] upload failed:", up.error.message);
        continue;
      }
      const { error } = await svc.from("egs_chat_images").insert({
        project_id: projectId,
        storage_path: path,
        media_type: img.mediaType,
        bytes: bytes.byteLength,
      });
      if (error) console.error("[chat-images] record failed:", error.message);
    } catch (e) {
      console.error("[chat-images] store error:", e);
    }
  }
}

export interface StoredChatImage {
  path: string;
  url: string; // short-lived signed URL (bucket is private)
  createdAt: string;
}

/**
 * List a project's previously-attached chat images as signed URLs, so the chat can re-show them
 * when the project is reopened. URLs are short-lived; the page re-fetches them on each load.
 */
export async function listProjectChatImages(projectId: string): Promise<StoredChatImage[]> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("egs_chat_images")
    .select("storage_path, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[chat-images] list failed:", error.message);
    return [];
  }
  const rows = (data ?? []) as { storage_path: string; created_at: string }[];
  if (rows.length === 0) return [];

  const { data: signed, error: sErr } = await svc.storage
    .from(CHAT_IMAGES_BUCKET)
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      3600,
    );
  if (sErr) {
    console.error("[chat-images] sign failed:", sErr.message);
    return [];
  }
  return rows
    .map((r, i) => ({ path: r.storage_path, url: signed?.[i]?.signedUrl ?? "", createdAt: r.created_at }))
    .filter((x) => x.url);
}

/**
 * Remove every stored chat image for a project from the bucket. Call BEFORE deleting the project
 * row (the egs_chat_images rows cascade away with it, taking the path list with them).
 */
export async function removeProjectChatImages(projectId: string): Promise<void> {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("egs_chat_images")
    .select("storage_path")
    .eq("project_id", projectId);
  if (error) {
    console.error("[chat-images] list-for-delete failed:", error.message);
    return;
  }
  const paths = (data ?? []).map((r) => (r as { storage_path: string }).storage_path);
  if (paths.length === 0) return;
  const { error: rmErr } = await svc.storage.from(CHAT_IMAGES_BUCKET).remove(paths);
  if (rmErr) console.error("[chat-images] storage remove failed:", rmErr.message);
}
