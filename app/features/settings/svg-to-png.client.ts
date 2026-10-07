import { fitLongerSide, type Size, svgShape } from "./svg-size.ts";

export function isSvg(file: File): boolean {
  return file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
}

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The SVG did not load."));
    image.src = url;
  });
}

/**
 * Turns an SVG file into a PNG with the same name, so no SVG reaches the server (D7, D167).
 * The file is only ever an `<img>` source behind a `blob:` URL - never parsed into the page -
 * so its scripts do not run and nothing outside it loads. Transparency is kept. Rejects when
 * the SVG does not load or the canvas will not give a PNG.
 */
export async function svgToPng(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const image = await load(url);
    // The root tag's own size first: a viewBox-only SVG reports a browser default otherwise.
    const measured: Size = { width: image.naturalWidth, height: image.naturalHeight };
    const shape = svgShape(await file.text()) ?? measured;
    if (!(shape.width > 0 && shape.height > 0)) throw new Error("The SVG has no size.");
    const { width, height } = fitLongerSide(shape);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No canvas.");
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("The canvas gave no PNG.");
    return new File([blob], file.name, { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}
