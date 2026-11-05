import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// Draws the placeholder pictures for the sample vault into apps/web/public/sample/.
// They are illustrations, clearly labelled "Example", so no one mistakes them for a real family.
// Replace each file with real, consented material before launch (see `pendingAssets` in
// packages/core/src/sample-vault.content.json); the pages need no change.
//
//   pnpm --filter @virasat/web sample:placeholders

const out = fileURLToPath(new URL("../public/sample/", import.meta.url));

const palette = {
  paper: "#F6F1E8",
  sunken: "#EDE6DA",
  ink: "#24201B",
  accent: "#8B4A2B",
  clay: "#C98B5E",
  wheat: "#E3C18F",
  leaf: "#6E7F4F",
  cream: "#FFFCF6",
};

const wrap = (width: number, height: number, body: string, label = "Example") => `
<html><body style="margin:0;width:${width}px;height:${height}px;overflow:hidden;font-family:Georgia,serif;position:relative;">
${body}
<div style="position:absolute;inset-inline:0;bottom:14px;text-align:center;font:600 ${Math.round(width / 50)}px sans-serif;letter-spacing:.12em;text-transform:uppercase;color:${palette.ink};opacity:.45">${label}</div>
</body></html>`;

const portrait = (initial: string, tint: string) =>
  wrap(
    600,
    600,
    `<div style="position:absolute;inset:0;background:radial-gradient(circle at 30% 25%,${tint},${palette.sunken} 70%)"></div>
     <div style="position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);width:300px;height:300px;border-radius:50%;background:${palette.cream};box-shadow:0 0 0 10px rgba(255,252,246,.6);display:flex;align-items:center;justify-content:center;font-size:150px;font-weight:600;color:${palette.accent}">${initial}</div>`,
  );

const plate = (inner: string, bg: string) =>
  wrap(
    900,
    675,
    `<div style="position:absolute;inset:0;background:${bg}"></div>
     <div style="position:absolute;left:50%;top:48%;transform:translate(-50%,-50%);width:470px;height:470px;border-radius:50%;background:${palette.cream};box-shadow:0 18px 40px rgba(36,32,27,.25),inset 0 0 0 14px #F1E9DA">${inner}</div>`,
  );

const flatbreads = `
  <div style="position:absolute;left:70px;top:90px;width:300px;height:300px;border-radius:50%;background:${palette.wheat};box-shadow:inset 0 0 0 6px ${palette.clay}"></div>
  <div style="position:absolute;left:100px;top:70px;width:290px;height:290px;border-radius:50%;background:#D9AE72;box-shadow:inset 0 0 0 5px ${palette.clay}"></div>
  <div style="position:absolute;left:140px;top:120px;width:20px;height:20px;border-radius:50%;background:${palette.leaf};box-shadow:60px 30px 0 ${palette.leaf},120px -10px 0 ${palette.leaf},30px 90px 0 ${palette.leaf},140px 100px 0 ${palette.leaf}"></div>`;

const bowl = `
  <div style="position:absolute;inset:60px;border-radius:50%;background:#E8C873;box-shadow:inset 0 0 0 10px ${palette.cream},inset 0 0 40px rgba(139,74,43,.35)"></div>
  <div style="position:absolute;left:150px;top:140px;width:12px;height:12px;border-radius:50%;background:${palette.accent};box-shadow:50px 20px 0 ${palette.accent},110px -10px 0 ${palette.accent},80px 80px 0 ${palette.leaf},20px 70px 0 ${palette.leaf}"></div>`;

const squares = `
  <div style="position:absolute;left:90px;top:90px;width:130px;height:130px;background:#D9AE72;border-radius:10px;box-shadow:140px 0 0 #D9AE72,0 140px 0 #D9AE72,140px 140px 0 #D9AE72,70px 70px 0 -10px ${palette.clay}"></div>`;

const scan = () => {
  let lines = "";
  for (let row = 0; row < 16; row++) {
    const y = 250 + row * 52;
    const width = row === 0 ? 420 : 520 + ((row * 97) % 180);
    const wobble = Array.from(
      { length: Math.floor(width / 28) },
      (_, i) => `${i === 0 ? "M" : "L"} ${60 + i * 28} ${y + (i % 2 ? -6 : 4) + ((i * row) % 5)}`,
    ).join(" ");
    lines += `<path d="${wobble}" stroke="${palette.ink}" stroke-opacity="${row === 0 ? 0.8 : 0.55}" stroke-width="${row === 0 ? 5 : 3}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  const ruled = Array.from(
    { length: 22 },
    (_, i) =>
      `<line x1="40" x2="760" y1="${230 + i * 52}" y2="${230 + i * 52}" stroke="#B9AD9C" stroke-opacity=".6"/>`,
  ).join("");
  return wrap(
    800,
    1200,
    `<div style="position:absolute;inset:0;background:#F3EAD6"></div>
     <svg viewBox="0 0 800 1200" width="800" height="1200" style="position:absolute;inset:0">
       <line x1="90" x2="90" y1="0" y2="1200" stroke="#C86F5C" stroke-opacity=".55" stroke-width="2"/>
       ${ruled}${lines}
     </svg>`,
    "Example page",
  );
};

const files: Record<string, string> = {
  "people/ba.jpg": portrait("Ba", "#E7C9A5"),
  "people/mom.jpg": portrait("Mom", "#E1BFA9"),
  "people/masi.jpg": portrait("Masi", "#D7C7A0"),
  "dishes/methi-thepla.jpg": plate(flatbreads, "linear-gradient(135deg,#B9C4A0,#8E9C6E)"),
  "dishes/kadhi.jpg": plate(bowl, "linear-gradient(135deg,#E9D7B4,#D3B583)"),
  "dishes/sukhdi.jpg": plate(squares, "linear-gradient(135deg,#D8B9A0,#B98B6C)"),
  "moments/mom-thepla.jpg": plate(flatbreads, "linear-gradient(135deg,#C9B9A4,#9E8B72)"),
  "moments/you-sukhdi.jpg": plate(squares, "linear-gradient(135deg,#BFCBD0,#8FA1AA)"),
  "scans/masi-kadhi.jpg": scan(),
};

const browser = await chromium.launch();
try {
  for (const [name, html] of Object.entries(files)) {
    const match = /width:(\d+)px;height:(\d+)px/.exec(html);
    const page = await browser.newPage({
      viewport: { width: Number(match?.[1]), height: Number(match?.[2]) },
    });
    await page.setContent(html);
    const path = `${out}${name}`;
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path, type: "jpeg", quality: 82 });
    await page.close();
    console.warn(`wrote public/sample/${name}`);
  }
} finally {
  await browser.close();
}
