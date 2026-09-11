/**
 * Table capture for review notes (L3): the felt area only, no chrome.
 * Works with either renderer — WebGL canvas or SVG — and always returns a PNG.
 */
export async function captureTable(): Promise<Blob | undefined> {
  const canvas = document.querySelector<HTMLCanvasElement>('main canvas');
  if (canvas) {
    // R3F clears the drawing buffer after each frame; ask for one more first.
    window.dispatchEvent(new Event('resize'));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return await new Promise<Blob | undefined>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? undefined), 'image/png'),
    );
  }

  const svg = Array.from(document.querySelectorAll('svg')).find(
    (s) => s.getAttribute('viewBox') === '0 0 1000 640',
  );
  if (!svg) return undefined;
  const source = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const out = document.createElement('canvas');
    out.width = 1000;
    out.height = 640;
    const ctx = out.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(img, 0, 0, out.width, out.height);
    return await new Promise<Blob | undefined>((resolve) =>
      out.toBlob((b) => resolve(b ?? undefined), 'image/png'),
    );
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(url);
  }
}
