// oklch -> sRGB hex, plus WCAG contrast, so the palette is derived not guessed.
const f = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);

function oklch(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const to255 = (v) => Math.max(0, Math.min(255, Math.round(f(v) * 255)));
  const [R, G, B] = [to255(r), to255(g), to255(bl)];
  const clipped = [r, g, bl].some((v) => f(v) < -0.002 || f(v) > 1.002);
  return { hex: "#" + [R, G, B].map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase(), rgb: [R, G, B], clipped };
}

const lum = ([r, g, b]) => {
  const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

// Warm stone neutrals + one eucalyptus accent + clay for the alarm state.
const HN = 80;   // neutral hue: warm sand/stone
const HA = 168;  // accent hue: eucalyptus
const light = {
  page:    oklch(0.958, 0.007, HN),
  surface: oklch(0.988, 0.004, HN),
  ink:     oklch(0.265, 0.009, 70),
  ink2:    oklch(0.487, 0.011, 70),
  muted:   oklch(0.558, 0.011, 70),
  grid:    oklch(0.893, 0.009, HN),
  axis:    oklch(0.802, 0.011, HN),
  accent:  oklch(0.512, 0.058, HA),
  accentQ: oklch(0.930, 0.020, HA),  // quiet accent wash (chips, active nav pill)
  good:    oklch(0.512, 0.058, HA),  // same family: "cleared" reads as the accent
  danger:  oklch(0.530, 0.105, 34),  // clay, not fire-engine red
};
const dark = {
  page:    oklch(0.186, 0.006, HN),
  surface: oklch(0.238, 0.007, HN),
  ink:     oklch(0.945, 0.006, HN),
  ink2:    oklch(0.775, 0.009, HN),
  muted:   oklch(0.650, 0.010, HN),
  grid:    oklch(0.305, 0.008, HN),
  axis:    oklch(0.390, 0.010, HN),
  accent:  oklch(0.760, 0.062, HA),
  accentQ: oklch(0.320, 0.022, HA),
  good:    oklch(0.760, 0.062, HA),
  danger:  oklch(0.710, 0.092, 34),
};

for (const [name, p] of [["LIGHT", light], ["DARK", dark]]) {
  console.log("\n" + name);
  for (const [k, v] of Object.entries(p)) console.log(`  ${k.padEnd(8)} ${v.hex}${v.clipped ? "  <-- OUT OF GAMUT" : ""}`);
  console.log(`  contrast ink/page      ${ratio(p.ink.rgb, p.page.rgb).toFixed(2)}`);
  console.log(`  contrast ink2/page     ${ratio(p.ink2.rgb, p.page.rgb).toFixed(2)}`);
  console.log(`  contrast muted/page    ${ratio(p.muted.rgb, p.page.rgb).toFixed(2)}`);
  console.log(`  contrast muted/surface ${ratio(p.muted.rgb, p.surface.rgb).toFixed(2)}`);
  console.log(`  contrast accent/page   ${ratio(p.accent.rgb, p.page.rgb).toFixed(2)}`);
  console.log(`  contrast danger/page   ${ratio(p.danger.rgb, p.page.rgb).toFixed(2)}`);
  const onAccent = name === "LIGHT" ? p.surface.rgb : p.page.rgb;
  console.log(`  contrast btn label     ${ratio(onAccent, p.accent.rgb).toFixed(2)}`);
  console.log(`  contrast accent/wash   ${ratio(p.accent.rgb, p.accentQ.rgb).toFixed(2)}`);
  console.log(`  contrast grid/surface  ${ratio(p.grid.rgb, p.surface.rgb).toFixed(2)}  (hairline, informational)`);
}

// Alternate accents for the two direction sketches, same L/C, different hue.
console.log("\nALTERNATE ACCENTS (same lightness + chroma, hue only)");
for (const [n, h] of [["clay", 44], ["mist", 236]]) {
  console.log(`  ${n.padEnd(5)} light ${oklch(0.512, 0.058, h).hex}   dark ${oklch(0.760, 0.062, h).hex}   wash ${oklch(0.930, 0.020, h).hex}`);
}
