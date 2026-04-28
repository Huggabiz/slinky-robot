// Read a user-selected image file, optionally downscale it, and
// return a base64 data-URL suitable for storing inline in the JSON.
// Capping the dimensions prevents multi-megabyte raw photos from
// bloating the file — the cover and section images only need to be
// screen/print-resolution, not camera-sensor-resolution.

const MAX_WIDTH = 1400;
const MAX_HEIGHT = 1400;

// Prompt the user with a file picker restricted to images. Returns
// the chosen file or null if cancelled.
export function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      resolve(input.files?.[0] ?? null);
    };
    // Some browsers never fire onchange when the dialog is cancelled.
    // A blur-based fallback handles that.
    const onFocus = () => {
      window.removeEventListener('focus', onFocus);
      setTimeout(() => {
        if (!input.files?.length) resolve(null);
      }, 300);
    };
    window.addEventListener('focus', onFocus);
    input.click();
  });
}

// Convert an image File to a base64 data-URL, downscaling if either
// dimension exceeds the cap. Uses an off-screen canvas so the browser
// handles decoding and re-encoding. Output format is always JPEG at
// 0.85 quality for photos, or PNG if the source is PNG with
// transparency — but for simplicity we always use JPEG here since
// cover/section images are typically photos or illustrations.
export async function fileToDataUrl(
  file: File,
  maxWidth = MAX_WIDTH,
  maxHeight = MAX_HEIGHT,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (width > maxWidth || height > maxHeight) {
    const scale = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
