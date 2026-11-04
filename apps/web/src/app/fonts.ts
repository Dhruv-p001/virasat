import {
  Fraunces,
  Noto_Sans,
  Noto_Sans_Devanagari,
  Noto_Sans_Gujarati,
  Noto_Serif_Devanagari,
  Noto_Serif_Gujarati,
} from "next/font/google";

// Each script is its own font so a browser only downloads the scripts on the page
// (unicode-range). Only Latin is preloaded; Gujarati and Devanagari load when text needs them.

const sans = Noto_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-sans-latin" });
const sansGujarati = Noto_Sans_Gujarati({
  subsets: ["gujarati"],
  variable: "--font-sans-gujarati",
  preload: false,
});
const sansDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-sans-devanagari",
  preload: false,
});

const serif = Fraunces({ subsets: ["latin", "latin-ext"], variable: "--font-serif-latin" });
const serifGujarati = Noto_Serif_Gujarati({
  subsets: ["gujarati"],
  variable: "--font-serif-gujarati",
  preload: false,
});
const serifDevanagari = Noto_Serif_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-serif-devanagari",
  preload: false,
});

export const fontVariables = [
  sans,
  sansGujarati,
  sansDevanagari,
  serif,
  serifGujarati,
  serifDevanagari,
]
  .map((font) => font.variable)
  .join(" ");
