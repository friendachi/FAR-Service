"use client";

/** Shrinks a photo to at most `max` px on the long side and re-encodes it as JPEG before upload. */
export async function shrink(file: Blob, max = 1920, quality = 0.86): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = Object.assign(document.createElement("canvas"), {
    width: Math.round(bmp.width * scale),
    height: Math.round(bmp.height * scale),
  });
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("แปลงรูปไม่สำเร็จ"))), "image/jpeg", quality));
}
