// Client-side image downscale + compression to keep uploads small and fast.
// Falls back to the original file if anything goes wrong or the result is larger.

export interface CompressOptions {
  maxDimension?: number; // longest edge in px
  quality?: number; // 0..1 for JPEG/WebP
  mimeType?: string; // output mime; defaults to image/jpeg (unless PNG w/ alpha)
}

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });

export async function compressImage(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  try {
    if (!file.type.startsWith("image/")) return file;
    // Never re-encode SVG or GIF (animation) — just return as-is.
    if (/svg|gif/i.test(file.type)) return file;

    const maxDim = opts.maxDimension ?? 1024;
    const quality = opts.quality ?? 0.82;
    const outType = opts.mimeType ?? "image/jpeg";

    const img = await loadImage(file);
    const { width, height } = img;
    const longest = Math.max(width, height);
    const scale = longest > maxDim ? maxDim / longest : 1;
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // white background if converting to JPEG (no alpha channel)
    if (outType === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);
    }
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), outType, quality),
    );
    if (!blob) return file;
    if (blob.size >= file.size) return file; // don't upload a bigger file

    const ext = outType === "image/png" ? "png" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.${ext}`, {
      type: outType,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
