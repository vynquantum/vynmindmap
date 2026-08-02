import type { Topic } from '../../../src/index.js';

/** MIME type for an embedded resource, derived from its path extension —
 * the only place the format survives, since resources are stored as raw bytes. */
export function mimeForPath(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'jpg') return 'image/jpeg';
  if (ext === 'svg') return 'image/svg+xml';
  return `image/${ext}`;
}

/** Store an image file in the workbook's resources and point the topic at it.
 * `TopicImage.resource` is a path into the zip's `resources/` folder, not the
 * image data: the renderer looks it up in `resources` and a topic holding
 * anything else (a data URL, say) draws nothing and saves nothing.
 * ponytail: replacing an image orphans the old bytes — resources are never
 * garbage-collected. Sweep unreferenced paths on save if .vmm files grow. */
export async function attachImage(
  file: File,
  topic: Topic,
  resources: Record<string, Uint8Array>
): Promise<void> {
  const named = /\.([a-z0-9]+)$/i.exec(file.name)?.[1];
  const ext = (named ?? file.type.split('/')[1] ?? 'png').toLowerCase().replace('+xml', '');
  const path = `resources/${crypto.randomUUID()}.${ext}`;
  resources[path] = new Uint8Array(await file.arrayBuffer());
  topic.image = { resource: path, ...(await fitSize(file)) };
}

/** Size an image renders at when it carries none of its own (legacy topics, or
 * a format the decoder could not measure). */
export const IMG_DEFAULT = { width: 96, height: 64 };

/** Bounds a rendered topic image is held to, wherever it is resized from. */
export const clampImageSize = (px: number): number => Math.max(24, Math.min(600, Math.round(px)));

/** Default display box for a freshly attached image. */
const FIT_W = 120;
const FIT_H = 90;

/**
 * Start an image at its own aspect ratio, scaled down into the default box.
 * Without this every image would open as a fixed 96×64 and the first resize
 * drag would stretch it. Formats the decoder can't measure (SVG in some
 * engines) fall back to the renderer's default, which is why this is optional.
 */
async function fitSize(file: File): Promise<{ width?: number; height?: number }> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(FIT_W / bmp.width, FIT_H / bmp.height, 1);
    const size = { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) };
    bmp.close();
    return size;
  } catch {
    return {};
  }
}
