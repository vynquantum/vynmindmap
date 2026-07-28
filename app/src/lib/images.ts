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
  topic.image = { resource: path };
}
