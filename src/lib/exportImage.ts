import { toPng, toJpeg, toSvg, toCanvas } from "html-to-image";
import jsPDF from "jspdf";
import { sanitizeFilename } from "./exporters";

export type ImageFormat = "png" | "jpg" | "webp" | "svg" | "pdf";
export type ImageScale = 1 | 2 | 4 | 8;

export const IMAGE_FORMATS: { value: ImageFormat; label: string; ext: string }[] = [
  { value: "png", label: "PNG", ext: "png" },
  { value: "jpg", label: "JPG", ext: "jpg" },
  { value: "webp", label: "WebP", ext: "webp" },
  { value: "svg", label: "SVG", ext: "svg" },
  { value: "pdf", label: "PDF", ext: "pdf" },
];

export const IMAGE_SCALES: { value: ImageScale; label: string; tag: string }[] = [
  { value: 1, label: "1× · Standard", tag: "web" },
  { value: 2, label: "2× · Retina", tag: "retina" },
  { value: 4, label: "4× · 4K", tag: "ultra" },
  { value: 8, label: "8× · 8K", tag: "print" },
];

export function formatSupportsScale(format: ImageFormat): boolean {
  return format !== "svg";
}

export function computeOutputSize(node: HTMLElement, scale: ImageScale): { w: number; h: number } {
  const rect = node.getBoundingClientRect();
  return { w: Math.round(rect.width * scale), h: Math.round(rect.height * scale) };
}

interface ExportOptions {
  node: HTMLElement;
  format: ImageFormat;
  scale: ImageScale;
  filename: string;
}

export async function exportImage({ node, format, scale, filename }: ExportOptions): Promise<void> {
  const safeName = sanitizeFilename(filename, "pastepretty");
  const baseOpts = {
    pixelRatio: scale,
    cacheBust: true,
  };

  let dataUrl: string;
  const ext = IMAGE_FORMATS.find((f) => f.value === format)?.ext ?? format;

  switch (format) {
    case "jpg":
      dataUrl = await toJpeg(node, { ...baseOpts, quality: 0.95 });
      break;
    case "webp": {
      const canvas = await toCanvas(node, baseOpts);
      dataUrl = canvas.toDataURL("image/webp", 0.95);
      break;
    }
    case "svg":
      dataUrl = await toSvg(node, { cacheBust: true });
      break;
    case "pdf": {
      const pngUrl = await toPng(node, baseOpts);
      const { w, h } = computeOutputSize(node, scale);
      const orientation = w >= h ? "landscape" : "portrait";
      const pdf = new jsPDF({
        orientation,
        unit: "px",
        format: [w, h],
        compress: true,
      });
      pdf.addImage(pngUrl, "PNG", 0, 0, w, h);
      pdf.save(`${safeName}.pdf`);
      return;
    }
    case "png":
    default:
      dataUrl = await toPng(node, baseOpts);
      break;
  }

  const link = document.createElement("a");
  link.download = `${safeName}.${ext}`;
  link.href = dataUrl;
  link.click();
}
