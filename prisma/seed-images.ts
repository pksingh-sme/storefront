// Generates clearly-labelled placeholder images for development seed data.
import sharp from "sharp";

export type Motif = "shawl" | "curtain" | "earring" | "dress" | "tote" | "hero" | "category";

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * (1 + amount));
  const g = clamp(((n >> 8) & 255) * (1 + amount));
  const b = clamp((n & 255) * (1 + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function escape(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function motifShapes(motif: Motif, color: string, variation: number, w: number, h: number) {
  const dark = shade(color, -0.25);
  const light = shade(color, 0.18);
  const cx = w / 2;
  switch (motif) {
    case "shawl": {
      const sway = [0, 60, -60][variation % 3];
      return `
        <path d="M${cx - 420} ${h * 0.18} Q${cx + sway} ${h * 0.05} ${cx + 420} ${h * 0.18} L${cx + 360 + sway} ${h * 0.8} Q${cx} ${h * 0.9} ${cx - 360 + sway} ${h * 0.8} Z" fill="${color}"/>
        ${Array.from({ length: 9 }, (_, i) => `<path d="M${cx - 340 + i * 85 + sway / 2} ${h * 0.2} Q${cx - 300 + i * 85} ${h * 0.5} ${cx - 330 + i * 85 + sway / 2} ${h * 0.82}" stroke="${dark}" stroke-width="10" fill="none" opacity="0.45"/>`).join("")}
        ${Array.from({ length: 26 }, (_, i) => `<line x1="${cx - 350 + i * 28 + sway}" y1="${h * 0.81}" x2="${cx - 350 + i * 28 + sway}" y2="${h * 0.86}" stroke="${dark}" stroke-width="6"/>`).join("")}`;
    }
    case "curtain": {
      const folds = 6 + (variation % 3);
      const panel = (x: number) =>
        Array.from({ length: folds }, (_, i) => {
          const fw = 560 / folds;
          return `<rect x="${x + i * fw}" y="${h * 0.12}" width="${fw}" height="${h * 0.76}" fill="${i % 2 ? color : light}"/>`;
        }).join("");
      return `<rect x="${cx - 640}" y="${h * 0.1}" width="1280" height="18" rx="9" fill="${dark}"/>${panel(cx - 620)}${panel(cx + 60)}`;
    }
    case "earring": {
      const r = 110 + variation * 20;
      const drop = (x: number) => `
        <circle cx="${x}" cy="${h * 0.3}" r="26" fill="none" stroke="${dark}" stroke-width="12"/>
        <line x1="${x}" y1="${h * 0.3 + 26}" x2="${x}" y2="${h * 0.45}" stroke="${dark}" stroke-width="8"/>
        <circle cx="${x}" cy="${h * 0.45 + r}" r="${r}" fill="${color}" stroke="${dark}" stroke-width="10"/>
        <circle cx="${x - r / 3}" cy="${h * 0.45 + r * 0.7}" r="${r / 5}" fill="${light}" opacity="0.8"/>`;
      return drop(cx - 260) + drop(cx + 260);
    }
    case "dress":
      return `<path d="M${cx - 150} ${h * 0.15} L${cx + 150} ${h * 0.15} L${cx + 190} ${h * 0.4} L${cx + 380 + variation * 30} ${h * 0.86} L${cx - 380 - variation * 30} ${h * 0.86} L${cx - 190} ${h * 0.4} Z" fill="${color}"/>
        <path d="M${cx - 190} ${h * 0.4} L${cx + 190} ${h * 0.4}" stroke="${dark}" stroke-width="16"/>`;
    case "tote":
      return `<path d="M${cx - 200} ${h * 0.38} Q${cx} ${h * 0.12} ${cx + 200} ${h * 0.38}" stroke="${dark}" stroke-width="26" fill="none"/>
        <rect x="${cx - 360}" y="${h * 0.36}" width="720" height="${h * 0.48}" rx="30" fill="${color}"/>
        ${Array.from({ length: 10 }, (_, i) => `<line x1="${cx - 340}" y1="${h * 0.4 + i * 90}" x2="${cx + 340}" y2="${h * 0.4 + i * 90}" stroke="${dark}" stroke-width="6" opacity="0.4"/>`).join("")}`;
    default:
      return `<circle cx="${w * 0.72}" cy="${h * 0.42}" r="${h * 0.32}" fill="${light}" opacity="0.7"/>
        <circle cx="${w * 0.82}" cy="${h * 0.62}" r="${h * 0.22}" fill="${color}" opacity="0.9"/>`;
  }
}

export async function placeholderImage(opts: {
  motif: Motif;
  color: string;
  label: string;
  sublabel?: string;
  variation?: number;
  width?: number;
  height?: number;
}): Promise<Buffer> {
  const w = opts.width ?? 1600;
  const h = opts.height ?? 2000;
  const variation = opts.variation ?? 0;
  const bgs = ["#F6F1E8", "#EFE7DA", "#F3ECE1"];
  const bg = opts.motif === "hero" || opts.motif === "category" ? shade(opts.color, 0.45) : bgs[variation % bgs.length];
  const textColor = luminance(bg) > 0.4 ? "#2B2A28" : "#FBF8F3";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="100%" height="100%" fill="${bg}"/>
    ${motifShapes(opts.motif, opts.color, variation, w, h)}
    <rect x="40" y="${h - 190}" width="${w - 80}" height="150" fill="${bg}" opacity="0.85"/>
    <text x="${w / 2}" y="${h - 120}" font-family="Georgia, serif" font-size="${Math.round(w / 28)}" text-anchor="middle" fill="${textColor}">${escape(opts.label)}</text>
    <text x="${w / 2}" y="${h - 62}" font-family="Helvetica, Arial, sans-serif" font-size="${Math.round(w / 52)}" letter-spacing="6" text-anchor="middle" fill="${textColor}">${escape(opts.sublabel ?? "SAMPLE IMAGE — REPLACE IN ADMIN")}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
