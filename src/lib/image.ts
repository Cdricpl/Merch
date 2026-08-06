// Compress an image file to a small data URL for storing in Firestore.
// Uses <canvas> to resize to max 512×512 and encode as JPEG at 0.75 quality.
// Typical output: 20-80 kB for a photo.

export async function fileToCompressedDataUrl(file: File, maxSide = 512, quality = 0.75): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");
  ctx.drawImage(bitmap, 0, 0, w, h);

  return canvas.toDataURL("image/jpeg", quality);
}
