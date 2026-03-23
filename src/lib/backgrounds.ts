import { Background } from "./types";

export const presetBackgrounds: { label: string; bg: Background }[] = [
  {
    label: "Cosmic",
    bg: {
      type: "gradient",
      gradient: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
    },
  },
  {
    label: "Aurora",
    bg: {
      type: "gradient",
      gradient: "linear-gradient(135deg, #00b4d8, #0077b6, #03045e)",
    },
  },
  {
    label: "Sunset",
    bg: {
      type: "gradient",
      gradient: "linear-gradient(135deg, #f5af19, #f12711)",
    },
  },
  {
    label: "Forest",
    bg: {
      type: "gradient",
      gradient: "linear-gradient(135deg, #134e5e, #71b280)",
    },
  },
  {
    label: "Candy",
    bg: {
      type: "gradient",
      gradient: "linear-gradient(135deg, #f953c6, #b91d73)",
    },
  },
  {
    label: "Ocean",
    bg: {
      type: "gradient",
      gradient: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)",
    },
  },
  {
    label: "Peach",
    bg: {
      type: "gradient",
      gradient: "linear-gradient(135deg, #f7971e, #ffd200)",
    },
  },
  {
    label: "Lavender",
    bg: {
      type: "gradient",
      gradient: "linear-gradient(135deg, #a18cd1, #fbc2eb)",
    },
  },
  {
    label: "Mint",
    bg: {
      type: "gradient",
      gradient: "linear-gradient(135deg, #00b09b, #96c93d)",
    },
  },
  {
    label: "Midnight",
    bg: {
      type: "solid",
      color: "#0d0d0d",
    },
  },
  {
    label: "Pure White",
    bg: {
      type: "solid",
      color: "#ffffff",
    },
  },
  {
    label: "Transparent",
    bg: {
      type: "none",
    },
  },
];

export function backgroundToCss(bg: Background): string {
  switch (bg.type) {
    case "solid":
      return bg.color ?? "#0d0d0d";
    case "gradient":
      return bg.gradient ?? "#0d0d0d";
    case "mesh":
      return `radial-gradient(at 40% 20%, ${bg.meshColors?.[0] ?? "#ff0080"} 0px, transparent 50%),
              radial-gradient(at 80% 0%, ${bg.meshColors?.[1] ?? "#7928ca"} 0px, transparent 50%),
              radial-gradient(at 0% 50%, ${bg.meshColors?.[2] ?? "#0070f3"} 0px, transparent 50%),
              #000`;
    case "none":
      return "transparent";
    default:
      return "#0d0d0d";
  }
}
