/** Phone helpers: shrink a photo before upload, and read the location. */

export async function shrinkPhoto(file: File, maxSide = 1280, quality = 0.72): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error("Could not read the photo.")); i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [quality, 0.55, 0.4]) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
      if (blob && blob.size <= 550 * 1024) return blob;
    }
    throw new Error("The photo is too large even after shrinking.");
  } finally { URL.revokeObjectURL(url); }
}

export type Fix = { latitude: number; longitude: number; accuracy_m: number };

export function locate(timeoutMs = 15000): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("This phone cannot share its location."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: +p.coords.latitude.toFixed(6), longitude: +p.coords.longitude.toFixed(6), accuracy_m: Math.round(p.coords.accuracy) }),
      (e) => reject(new Error(e.code === 1 ? "Location is blocked. Allow it for Oko in the browser settings." : "Could not get your location. Step outside and try again.")),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 });
  });
}
