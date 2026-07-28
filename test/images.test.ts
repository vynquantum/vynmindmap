import { describe, it, expect } from 'vitest';
import { attachImage, mimeForPath } from '../app/src/lib/images.js';
import { createWorkbook, writeVmm, readVmm } from '../src/index.js';

describe('attachImage', () => {
  it('stores bytes under the resource path the topic points at, and survives a .vmm round trip', async () => {
    const wb = createWorkbook();
    const topic = wb.sheets[0]!.rootTopic;
    const resources: Record<string, Uint8Array> = {};
    const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);

    await attachImage(new File([bytes], 'photo.PNG', { type: 'image/png' }), topic, resources);

    // The renderer resolves topic.image.resource through `resources` — a topic
    // holding the image data itself would draw nothing.
    expect(resources[topic.image!.resource]).toEqual(bytes);
    expect(mimeForPath(topic.image!.resource)).toBe('image/png');

    const back = readVmm(writeVmm(wb, resources));
    expect(back.resources[topic.image!.resource]).toEqual(bytes);
  });

  it('names the resource so its MIME type survives, extension or not', async () => {
    const resources: Record<string, Uint8Array> = {};
    const topic = createWorkbook().sheets[0]!.rootTopic;

    await attachImage(new File([], 'scan', { type: 'image/svg+xml' }), topic, resources);
    expect(mimeForPath(topic.image!.resource)).toBe('image/svg+xml');

    await attachImage(new File([], 'holiday.jpg', { type: 'image/jpeg' }), topic, resources);
    expect(mimeForPath(topic.image!.resource)).toBe('image/jpeg');

    await attachImage(new File([], 'logo.webp', { type: 'image/webp' }), topic, resources);
    expect(mimeForPath(topic.image!.resource)).toBe('image/webp');
  });
});
