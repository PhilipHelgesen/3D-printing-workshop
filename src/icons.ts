import { supabase } from './supabase.ts';

/**
 * Imported icons live in `iconId` as a URL — anything that isn't one of the
 * curated swatch ids (`a`/`b`/`c`) is the maker's own picture. Covers both
 * Supabase Storage URLs (new uploads) and old inline data URLs (pre-Supabase
 * entries still sitting in someone's localStorage).
 */
export const isImported = (iconId: string) => iconId.startsWith('http') || iconId.startsWith('data:');

/** 2× the 52px chip, so it stays sharp without bloating storage. */
const MAX_EDGE = 104;
const MAX_SVG_BYTES = 200_000;

/** Downscale to a small blob client-side, then upload. Throws with a readable reason. */
export async function uploadIcon(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That is not an image file.');

  let blob: Blob = file;
  let ext = 'webp';

  // SVG can't go through createImageBitmap in every browser, and it's already tiny.
  if (file.type === 'image/svg+xml') {
    if (file.size > MAX_SVG_BYTES) throw new Error('That SVG is too big — keep it under 200 KB.');
    ext = 'svg';
  } else {
    const bitmap = await createImageBitmap(file).catch(() => {
      throw new Error("That image couldn't be read.");
    });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("That image couldn't be processed."))), 'image/webp', 0.85),
    );
  }

  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('icons').upload(path, blob, { contentType: blob.type });
  if (error) throw new Error('Upload failed — check your connection and try again.');

  return supabase.storage.from('icons').getPublicUrl(path).data.publicUrl;
}
