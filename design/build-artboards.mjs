// Composes every .dc.html artboard from one shared token + component system,
// so ten screens can't drift apart. Edit here, re-run, re-seed.
import { writeFileSync } from "node:fs";

const L = {
  page:"#F4F1EC", surface:"#FCFBF8", ink:"#282521", ink2:"#645F59", muted:"#78736D",
  grid:"#DFDBD5", axis:"#C2BEB7", accent:"#447260", wash:"#DCECE5",
  good:"#447260", danger:"#9F5342", onAccent:"#FCFBF8",
};
const D = {
  page:"#141310", surface:"#211E1B", ink:"#EFECE8", ink2:"#B9B5AF", muted:"#928F88",
  grid:"#312F2B", axis:"#48443F", accent:"#8BBEAA", wash:"#283731",
  good:"#8BBEAA", danger:"#D48C7B", onAccent:"#141310",
};

const FONTLINK = "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400..600&amp;family=Newsreader:opsz,wght@6..72,300..500&amp;display=swap";

const css = (p) => `
    :root{
      --page:${p.page}; --surface:${p.surface}; --ink:${p.ink}; --ink-2:${p.ink2};
      --muted:${p.muted}; --grid:${p.grid}; --axis:${p.axis}; --accent:${p.accent};
      --wash:${p.wash}; --good:${p.good}; --danger:${p.danger}; --on-accent:${p.onAccent};
      --ui:'Instrument Sans',system-ui,-apple-system,'Segoe UI',sans-serif;
      --display:'Newsreader',Georgia,'Times New Roman',serif;
    }
    *{box-sizing:border-box}
    body{margin:0;background:var(--page);color:var(--ink);font-family:var(--ui);
      font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}
    a{color:var(--accent);text-decoration:none} a:hover{color:var(--ink)}
    p,h1,h2,h3{margin:0}
    .num{font-family:var(--display);font-variant-numeric:tabular-nums;font-weight:400}

    .screen{position:relative;width:390px;min-height:100%;background:var(--page);
      display:flex;flex-direction:column;overflow:hidden}
    .body{flex-grow:1;display:flex;flex-direction:column;gap:26px;padding:30px 20px 108px}
    .head{display:flex;flex-direction:column;gap:7px}
    h1{font-family:var(--display);font-size:29px;line-height:1.1;font-weight:400;letter-spacing:-0.01em}
    .sub{font-size:13.5px;line-height:1.5;color:var(--ink-2)}
    .eyebrow{font-size:10.5px;font-weight:600;letter-spacing:0.11em;text-transform:uppercase;color:var(--muted)}

    .card{background:var(--surface);border:1px solid var(--grid);border-radius:20px;padding:18px}
    .stack{display:flex;flex-direction:column}
    .rowx{display:flex;align-items:center}

    .cta{height:86px;border-radius:24px;background:var(--accent);color:var(--on-accent);
      font-family:var(--ui);font-size:18px;font-weight:500;letter-spacing:0.005em;
      display:flex;align-items:center;justify-content:center;gap:11px;border:none;width:100%}
    .ghost{height:54px;border-radius:18px;background:transparent;color:var(--accent);
      border:1px solid var(--accent);font-family:var(--ui);font-size:15px;font-weight:500;
      display:flex;align-items:center;justify-content:center;gap:9px;width:100%}
    .quiet{font-size:13.5px;color:var(--ink-2);text-decoration:underline;
      text-decoration-color:var(--axis);text-underline-offset:3px}

    .divide{border-top:1px solid var(--grid)}
    .chip{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 11px;
      border-radius:999px;border:1px solid var(--accent);color:var(--accent);
      font-size:12.5px;font-weight:500;letter-spacing:0.01em}

    .tabbar{position:absolute;left:0;right:0;bottom:0;height:84px;background:var(--surface);
      border-top:1px solid var(--grid);display:grid;grid-template-columns:repeat(5,1fr);
      align-items:start;padding-top:10px}
    .tab{display:flex;flex-direction:column;align-items:center;gap:5px;color:var(--muted);
      font-size:10.5px;font-weight:500;letter-spacing:0.01em}
    .tab .pill{width:54px;height:30px;border-radius:999px;display:flex;align-items:center;
      justify-content:center}
    .tab.on{color:var(--accent)} .tab.on .pill{background:var(--wash)}

    .mrow{display:flex;align-items:center;gap:13px;height:52px;border-bottom:1px solid var(--grid)}
    .box{width:21px;height:21px;flex:none;border-radius:7px;border:1.5px solid var(--axis);
      display:flex;align-items:center;justify-content:center}
    .box.on{background:var(--accent);border-color:var(--accent)}
    .track{height:5px;border-radius:999px;background:var(--grid);overflow:hidden}
    .fill{height:100%;background:var(--accent);border-radius:999px}
`;

const ic = (d, sw = 1.6) =>
  `<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const ICONS = {
  log: '<path d="M12 5.5v13M5.5 12h13"/>',
  peak: '<path d="M3.5 18.5h17L13.2 6.4a1.5 1.5 0 0 0-2.4 0z"/>',
  history: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3 1.9"/>',
  meals: '<path d="M7 3v18M4.2 3v4.6a2.8 2.8 0 0 0 5.6 0V3"/><path d="M16.8 21V3.4c1.9 1.3 3 3.6 3 6.2 0 2.5-1.1 4.4-3 5.1"/>',
  trends: '<path d="M4 16.5l5-5 3.3 3.3L20 7.5m0 0h-4.3M20 7.5v4.3"/>',
};
const check = '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="var(--on-accent)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.6 8.4l3.4 3.4 7.4-7.9"/></svg>';

const tabbar = (active) => `
      <nav class="tabbar">
${["log:Log", "peak:Peak", "history:History", "meals:Meals", "trends:Trends"]
  .map((t) => {
    const [k, label] = t.split(":");
    return `        <div class="tab${k === active ? " on" : ""}"><span class="pill">${ic(ICONS[k])}</span>${label}</div>`;
  })
  .join("\n")}
      </nav>`;

const page = ({ mode, body, tab }) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="${FONTLINK}">
  <style>${css(mode === "dark" ? D : L)}  </style>
</helmet>
<div class="screen">
  <div class="body">
${body}
  </div>
${tab ? tabbar(tab) : ""}
</div>
</x-dc>
</body>
</html>
`;

/* ---------------------------------------------------------------- screens */

const head = (h1, sub) =>
  `    <div class="head"><h1>${h1}</h1><p class="sub">${sub}</p></div>`;

const logBody = `
${head("Good afternoon", "My medication &middot; 10&#8239;mg typical, lasts about 4&#8239;h")}
    <div class="stack" style="gap:16px">
      <div class="cta">${ic(ICONS.log, 1.8)}Log 10&#8239;mg now</div>
      <div style="display:flex;justify-content:center"><span class="quiet">Different amount, time, or notes?</span></div>
    </div>
    <div class="card stack" style="gap:14px">
      <div class="rowx" style="justify-content:space-between">
        <span class="eyebrow">Last 24 hours</span>
        <span class="eyebrow" style="color:var(--accent)">3 doses</span>
      </div>
      <div class="stack" style="gap:3px">
        <p style="font-size:15px">Last dose <span class="num" style="font-size:17px">2&#8239;h 12&#8239;min</span> ago</p>
        <p class="sub" style="color:var(--muted)">Typically wears off around 6:40 PM</p>
      </div>
      <div class="divide stack" style="padding-top:4px">
${[["10 mg", "2:28 PM"], ["10 mg", "9:05 AM"], ["5 mg", "Yesterday, 8:40 PM"]]
  .map(
    ([a, t], i) =>
      `        <div class="rowx" style="justify-content:space-between;height:42px;${i ? "border-top:1px solid var(--grid)" : ""}">
          <span class="num" style="font-size:16px">${a.replace(" ", "&#8239;")}</span>
          <span style="font-size:13.5px;color:var(--ink-2)">${t}</span>
        </div>`
  )
  .join("\n")}
      </div>
      <div class="divide" style="padding-top:14px"><a href="#" style="font-size:13.5px;font-weight:500">Full history &rarr;</a></div>
    </div>`;

const peakBody = `
${head("Log peak", "Mark the moment the medication peaked.")}
    <div class="stack" style="gap:16px">
      <div class="cta">${ic(ICONS.peak, 1.8)}Record peak now</div>
      <div style="display:flex;justify-content:center"><span class="quiet">Different time, dose, or notes?</span></div>
    </div>
    <div class="card stack" style="gap:13px">
      <span class="eyebrow">Will link to</span>
      <div class="stack" style="gap:3px">
        <p style="font-size:15px"><span class="num" style="font-size:17px">10&#8239;mg</span> taken at 2:28 PM</p>
        <p class="sub" style="color:var(--muted)">That puts this peak <span class="num">2&#8239;h 47&#8239;min</span> after the dose.</p>
      </div>
      <div class="divide" style="padding-top:13px;display:flex;gap:8px">
        <span class="chip">Peak 5:15 PM</span>
        <span class="chip" style="border-color:var(--axis);color:var(--ink-2)">Change dose</span>
      </div>
    </div>`;

const doseCard = (mg, time, peak, after, note) => `
      <div class="card stack" style="gap:11px;padding:16px">
        <div class="rowx" style="justify-content:space-between">
          <p><span class="num" style="font-size:18px">${mg}</span> <span style="font-size:13.5px;color:var(--ink-2);margin-left:4px">${time}</span></p>
          <span style="color:var(--muted)">${ic('<path d="M4.5 7h15M9.5 7V5.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7m2.6 0-.9 12.1a1 1 0 0 1-1 .9H8.8a1 1 0 0 1-1-.9L7 7"/>', 1.5)}</span>
        </div>${note ? `\n        <p class="sub">${note}</p>` : ""}${
          peak
            ? `\n        <div class="rowx" style="gap:10px;flex-wrap:wrap;padding:11px 13px;border:1px solid var(--grid);border-radius:14px;background:var(--page)">
          <span class="chip">Peak ${peak}</span>
          <span style="font-size:13px;color:var(--ink-2)"><span class="num">${after}</span> after dose</span>
        </div>`
            : ""
        }
      </div>`;

const historyBody = `
${head("History", "Doses with their peaks, newest first.")}
    <div class="stack" style="gap:11px">
      <span class="eyebrow">Today</span>
${doseCard("10&#8239;mg", "2:28 PM", "5:15 PM", "2&#8239;h 47&#8239;min", "")}
${doseCard("10&#8239;mg", "9:05 AM", "11:20 AM", "2&#8239;h 15&#8239;min", "with breakfast")}
    </div>
    <div class="stack" style="gap:11px">
      <span class="eyebrow">Yesterday</span>
${doseCard("5&#8239;mg", "8:40 PM", "", "", "half dose, late start")}
    </div>`;

const mealRow = (label, kcal, pro, on) => `
        <div class="mrow">
          <span class="box${on ? " on" : ""}">${on ? check : ""}</span>
          <span style="flex-grow:1;font-size:15px;${on ? "color:var(--ink-2)" : ""}">${label}</span>
          <span class="num" style="font-size:15px;color:${on ? "var(--ink-2)" : "var(--ink)"}">${kcal}<span style="font-size:12.5px;color:var(--muted)"> &middot; ${pro}p</span></span>
        </div>`;

const mealSection = (name, sub, rows) => `
      <div class="stack" style="gap:0">
        <div class="rowx" style="justify-content:space-between;padding-bottom:9px;border-bottom:1px solid var(--axis)">
          <span class="eyebrow">${name}</span>
          <span class="num" style="font-size:12.5px;color:${sub ? "var(--accent)" : "var(--muted)"}">${sub || "&mdash;"}</span>
        </div>
${rows.map((r) => mealRow(...r)).join("\n")}
      </div>`;

const mealsSummary = `
    <div class="card stack" style="gap:0;padding:20px">
      <div class="rowx" style="justify-content:space-between">
        <span class="eyebrow">Thursday, Sep 3</span>
        <span class="eyebrow" style="color:var(--accent)">2.7 lb/wk pace</span>
      </div>
      <div class="rowx" style="gap:14px;align-items:flex-end;margin-top:14px">
        <span class="num" style="font-size:62px;line-height:0.85;color:var(--accent)">599</span>
        <div class="stack" style="gap:1px;padding-bottom:4px">
          <span style="font-size:14.5px">calories left</span>
          <span style="font-size:13px;color:var(--ink-2)"><span class="num">1,226</span> of <span class="num">1,825</span> eaten</span>
        </div>
      </div>
      <div class="divide stack" style="gap:9px;margin-top:18px;padding-top:15px">
        <div class="rowx" style="justify-content:space-between">
          <span style="font-size:14px">Protein</span>
          <span class="num" style="font-size:14px;color:var(--ink-2)">116 of 140&#8239;g</span>
        </div>
        <div class="track"><div class="fill" style="width:83%"></div></div>
        <span style="font-size:12px;color:var(--muted)"><span class="num">24&#8239;g</span> to go. This is a floor, not a cap.</span>
      </div>
      <div class="divide rowx" style="gap:22px;margin-top:15px;padding-top:14px">
${[["Carbs", "28g"], ["Fat", "16g"], ["Deficit", "1,361"]]
  .map(
    ([k, v]) =>
      `        <span style="font-size:12px;color:var(--muted)">${k} <span class="num" style="font-size:15px;color:var(--ink)">${v}</span></span>`
  )
  .join("\n")}
      </div>
    </div>`;

const mealsTopBody = `
${head("Meals", "Check off what you actually ate. Resets at midnight.")}
${mealsSummary}
${mealSection("Coffee", "", [["Coffee or espresso", "5", "0", false], ["Splash of milk", "66", "4", false], ["Caramel drizzle", "50", "0", false]])}
${mealSection("Breakfast", "140 kcal", [["2 eggs", "140", "12", true], ["2 slices bread", "140", "8", false], ["Jam", "50", "0", false]])}`;

const mealsEndBody = `
${mealSection("Lunch", "391 kcal", [["Half a chicken breast", "277", "55", true], ["Sweet potato", "100", "2", true], ["Broccoli", "14", "2", true]])}
${mealSection("Snack", "", [["Yogurt cup", "80", "12", false], ["Nectarine", "62", "1", false], ["Banana", "89", "1", false]])}
${mealSection("Post-lift", "120 kcal", [["Scoop of whey", "120", "24", true]])}
${mealSection("Dinner", "", [["Whey in water", "120", "24", false], ["2 slices toast", "140", "8", false], ["Peanut butter, 2 tbsp", "190", "8", false]])}
      <div class="stack" style="gap:0">
        <div class="rowx" style="justify-content:space-between;padding-bottom:9px;border-bottom:1px solid var(--axis)">
          <span class="eyebrow">Added</span>
          <span class="num" style="font-size:12.5px;color:var(--accent)">689 kcal</span>
        </div>
${[["Banana", "89", "1"], ["Two slices of pizza", "600", "24"]]
  .map(
    ([n, k, p]) => `        <div class="mrow">
          <span class="box on">${check}</span>
          <span style="flex-grow:1;font-size:15px;color:var(--ink-2)">${n}</span>
          <span class="num" style="font-size:15px;color:var(--ink-2)">${k}<span style="font-size:12.5px;color:var(--muted)"> &middot; ${p}p</span></span>
          <span style="color:var(--muted);font-size:17px;padding-left:4px">&times;</span>
        </div>`
  )
  .join("\n")}
      </div>
    <div class="ghost">${ic('<path d="M12 5.5v13M5.5 12h13"/>', 1.7)}Add something else</div>
    <div class="divide stack" style="gap:9px;padding-top:16px">
      <p style="font-size:12px;color:var(--muted);line-height:1.6">Maintenance <span class="num">2,587</span> &middot; target <span class="num">1,825</span> &middot; protein floor <span class="num">140&#8239;g</span><br>Uncheck anything you skip, then add what you ate instead.</p>
      <span class="quiet" style="font-size:12.5px">Clear today</span>
    </div>`;

const linePts = [2.9, 3.3, 2.6, 3.4, 2.8, 2.4, 3.1, 2.7, 2.3, 2.9, 2.5, 2.2, 2.6, 2.4];
const CW = 306, CH = 168;
const px = (i) => 4 + (i * (CW - 8)) / (linePts.length - 1);
const py = (h) => CH - 10 - ((h - 1.6) / (4.6 - 1.6)) * (CH - 26);
const poly = linePts.map((h, i) => `${px(i).toFixed(1)},${py(h).toFixed(1)}`).join(" ");
const dots = linePts
  .map((h, i) => `<circle cx="${px(i).toFixed(1)}" cy="${py(h).toFixed(1)}" r="3.1" fill="var(--accent)" stroke="var(--surface)" stroke-width="1.6"/>`)
  .join("");
const gridLines = [2, 3, 4]
  .map((h) => `<line x1="0" y1="${py(h).toFixed(1)}" x2="${CW}" y2="${py(h).toFixed(1)}" stroke="var(--grid)" stroke-width="1"/>`)
  .join("");

const bars = [0, 1, 6, 12, 4, 1];
const BW = 306, BH = 132;
const barSvg = bars
  .map((c, i) => {
    const h = (c / 12) * (BH - 24);
    const w = 15, gap = (BW - bars.length * w) / bars.length;
    const x = i * (w + gap) + gap / 2;
    return `<rect x="${x.toFixed(1)}" y="${(BH - 18 - h).toFixed(1)}" width="${w}" height="${Math.max(h, 1).toFixed(1)}" rx="4" fill="var(--accent)" opacity="${c ? 1 : 0.25}"/><text x="${(x + w / 2).toFixed(1)}" y="${BH - 4}" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="var(--ui)">${i}h</text>`;
  })
  .join("");

const tile = (label, value, sub) => `
        <div class="card stack" style="gap:2px;padding:14px 13px;border-radius:16px">
          <span style="font-size:10.5px;letter-spacing:0.09em;text-transform:uppercase;color:var(--muted);font-weight:600">${label}</span>
          <span class="num" style="font-size:24px;line-height:1.2">${value}</span>${sub ? `\n          <span style="font-size:11px;color:var(--ink-2)">${sub}</span>` : ""}
        </div>`;

const trendsBody = `
${head("Trends", "How long the medication takes to peak.")}
    <div class="rowx" style="gap:4px;padding:4px;border:1px solid var(--grid);background:var(--surface);border-radius:16px">
${["7d", "30d", "90d", "All"]
  .map(
    (r) =>
      `      <div style="flex-grow:1;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:13.5px;font-weight:500;${
        r === "30d" ? "background:var(--accent);color:var(--on-accent)" : "color:var(--ink-2)"
      }">${r}</div>`
  )
  .join("\n")}
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px">
${tile("Avg to peak", "2h 41m", "&darr; 12m vs prior 30d")}
${tile("Peaks", "24", "")}
${tile("Doses", "26", "")}
    </div>
    <div class="card stack" style="gap:4px">
      <span class="eyebrow">Time to peak</span>
      <p style="font-size:12.5px;color:var(--muted);line-height:1.5">Hours from dose to peak, one point per logged peak.</p>
      <svg viewBox="0 0 ${CW} ${CH}" width="100%" height="${CH}" style="margin-top:10px;overflow:visible">
        ${gridLines}
        <line x1="0" y1="${py(4).toFixed(1)}" x2="${CW}" y2="${py(4).toFixed(1)}" stroke="var(--axis)" stroke-width="1" stroke-dasharray="4 4"/>
        <text x="2" y="${(py(4) - 6).toFixed(1)}" font-size="9.5" fill="var(--muted)" font-family="var(--ui)">wears off ~4 h</text>
        <polyline points="${poly}" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
        ${dots}
${[2, 3, 4].map((h) => `        <text x="${CW - 2}" y="${(py(h) - 4).toFixed(1)}" text-anchor="end" font-size="9.5" fill="var(--muted)" font-family="var(--ui)">${h}h</text>`).join("\n")}
      </svg>
    </div>
    <div class="card stack" style="gap:4px">
      <span class="eyebrow">How long it usually takes</span>
      <p style="font-size:12.5px;color:var(--muted);line-height:1.5">Number of peaks by hours after the dose.</p>
      <svg viewBox="0 0 ${BW} ${BH}" width="100%" height="${BH}" style="margin-top:10px">
        <line x1="0" y1="${BH - 18}" x2="${BW}" y2="${BH - 18}" stroke="var(--grid)" stroke-width="1"/>
        ${barSvg}
      </svg>
    </div>`;

const direction = (name, accent, wash, note) => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="${FONTLINK}">
  <style>${css({ ...L, accent, wash })}  </style>
</helmet>
<div class="screen">
  <div class="body" style="padding:26px 20px 26px;gap:20px">
    <div class="stack" style="gap:6px">
      <h1 style="font-size:24px">${name}</h1>
      <p class="sub" style="color:var(--muted)">${note}</p>
    </div>
    <div class="rowx" style="gap:8px">
${[accent, wash, L.page, L.ink]
  .map((c) => `      <span style="width:44px;height:44px;border-radius:12px;background:${c};border:1px solid var(--grid)"></span>`)
  .join("\n")}
    </div>
    <div class="cta" style="height:70px;font-size:17px">Log 10&#8239;mg now</div>
    <div class="card stack" style="gap:10px">
      <span class="eyebrow">Last 24 hours</span>
      <p style="font-size:14.5px">Last dose <span class="num" style="font-size:16px">2&#8239;h 12&#8239;min</span> ago</p>
      <div class="track"><div class="fill" style="width:64%"></div></div>
      <div class="rowx" style="gap:8px;padding-top:2px">
        <span class="chip">Peak 5:15 PM</span>
      </div>
    </div>
  </div>
</div>
</x-dc>
</body>
</html>
`;

const swatchRow = (p, label) => `
  <div class="stack" style="gap:9px">
    <span class="eyebrow">${label}</span>
    <div style="display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:8px">
${[["page", p.page], ["surface", p.surface], ["grid", p.grid], ["muted", p.muted], ["ink-2", p.ink2], ["ink", p.ink], ["accent", p.accent], ["wash", p.wash], ["danger", p.danger]]
  .map(
    ([n, hex]) => `      <div class="stack" style="gap:5px">
        <span style="height:52px;border-radius:12px;background:${hex};border:1px solid ${p.grid}"></span>
        <span style="font-size:10.5px;color:${L.ink2}">${n}</span>
        <span class="num" style="font-size:10.5px;color:${L.muted}">${hex}</span>
      </div>`
  )
  .join("\n")}
    </div>
  </div>`;

const foundations = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="${FONTLINK}">
  <style>${css(L)}  </style>
</helmet>
<div style="width:880px;min-height:100%;background:var(--page);color:var(--ink);font-family:var(--ui);padding:36px 40px 44px;display:flex;flex-direction:column;gap:34px">
  <div class="stack" style="gap:7px">
    <h1 style="font-size:32px">Foundations</h1>
    <p class="sub" style="max-width:60ch">Warm stone neutrals, one eucalyptus accent, clay for the alarm state. Every value is oklch-derived and contrast-checked, and drops straight into the <span class="num">:root</span> block in <span class="num">app/globals.css</span>.</p>
  </div>

${swatchRow(L, "Light")}
${swatchRow(D, "Dark")}

  <div class="stack" style="gap:14px">
    <span class="eyebrow">Type</span>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px">
      <div class="stack" style="gap:11px">
        <p class="num" style="font-size:40px;line-height:1.05">Newsreader</p>
        <p style="font-size:12.5px;color:var(--ink-2);line-height:1.6">Screen titles and every number the app reports &mdash; doses, hours to peak, calories. A calm editorial serif does the work a bold sans was doing before, without shouting. Falls back to Georgia.</p>
        <p class="num" style="font-size:26px">1,825 &middot; 2&#8239;h 47&#8239;min &middot; 10&#8239;mg</p>
      </div>
      <div class="stack" style="gap:11px">
        <p style="font-size:40px;line-height:1.05;font-weight:500">Instrument Sans</p>
        <p style="font-size:12.5px;color:var(--ink-2);line-height:1.6">Everything else: labels, body copy, buttons, navigation. Set at 400 and 500 only &mdash; the weight jumps that made the old UI feel busy are gone. Falls back to system-ui.</p>
        <p style="font-size:15px">Uncheck anything you skip, then add what you ate instead.</p>
      </div>
    </div>
  </div>

  <div class="stack" style="gap:14px">
    <span class="eyebrow">Components</span>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;align-items:start">
      <div class="stack" style="gap:11px">
        <div class="cta" style="height:76px">Log 10&#8239;mg now</div>
        <div class="ghost">Add something else</div>
        <div style="height:46px;border-radius:14px;border:1px solid var(--grid);background:var(--surface);display:flex;align-items:center;padding:0 14px;color:var(--muted);font-size:14.5px">Amount (mg)</div>
      </div>
      <div class="stack" style="gap:11px">
        <div class="rowx" style="gap:4px;padding:4px;border:1px solid var(--grid);background:var(--surface);border-radius:16px">
${["7d", "30d", "90d", "All"].map((r) => `          <div style="flex-grow:1;height:34px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:500;${r === "30d" ? "background:var(--accent);color:var(--on-accent)" : "color:var(--ink-2)"}">${r}</div>`).join("\n")}
        </div>
        <div class="card stack" style="gap:10px;padding:15px">
          <span class="eyebrow">Card</span>
          <div class="track"><div class="fill" style="width:72%"></div></div>
          <div class="rowx" style="gap:8px"><span class="chip">Peak 5:15 PM</span></div>
        </div>
      </div>
      <div class="stack" style="gap:11px">
        <div class="card stack" style="gap:0;padding:4px 15px">
${[["2 eggs", "140", true], ["2 slices bread", "140", false]]
  .map(
    ([n, k, on], i) => `          <div class="mrow" style="${i === 1 ? "border-bottom:none" : ""}">
            <span class="box${on ? " on" : ""}">${on ? check : ""}</span>
            <span style="flex-grow:1;font-size:14.5px;${on ? "color:var(--ink-2)" : ""}">${n}</span>
            <span class="num" style="font-size:14.5px;color:var(--ink-2)">${k}</span>
          </div>`
  )
  .join("\n")}
        </div>
      </div>
    </div>
    <div style="position:relative;width:390px;height:84px;border:1px solid var(--grid);border-radius:16px;background:var(--surface);overflow:hidden;margin-top:4px">
${tabbar("log").replace('class="tabbar"', 'class="tabbar" style="border-top:none"')}
    </div>
  </div>

  <div class="stack" style="gap:10px">
    <span class="eyebrow">Measures</span>
    <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px">
${[
  ["Radius", "20px cards &middot; 24px primary &middot; 16px tiles &middot; 999px chips"],
  ["Rhythm", "26px between sections &middot; 18px card padding &middot; 30px page top"],
  ["Hairlines", "1px in --grid, and no shadow anywhere in light mode"],
  ["Targets", "86px primary &middot; 52px rows &middot; 84px tab bar"],
]
  .map(
    ([k, v]) => `      <div class="stack" style="gap:4px">
        <span style="font-size:12.5px;font-weight:500">${k}</span>
        <span style="font-size:12px;color:var(--ink-2);line-height:1.6">${v}</span>
      </div>`
  )
  .join("\n")}
    </div>
  </div>
</div>
</x-dc>
</body>
</html>
`;

const out = (name, content) => { writeFileSync(new URL(`./${name}`, import.meta.url), content); console.log("wrote", name, content.length); };

out("Main.dc.html", page({ mode: "light", body: logBody, tab: "log" }));
out("LogDark.dc.html", page({ mode: "dark", body: logBody, tab: "log" }));
out("Peak.dc.html", page({ mode: "dark", body: peakBody, tab: "peak" }));
out("History.dc.html", page({ mode: "light", body: historyBody, tab: "history" }));
out("Meals.dc.html", page({ mode: "light", body: mealsTopBody, tab: "meals" }));
out("MealsEnd.dc.html", page({ mode: "dark", body: mealsEndBody, tab: "meals" }));
out("Trends.dc.html", page({ mode: "light", body: trendsBody, tab: "trends" }));
out("Foundations.dc.html", foundations);
out("DirectionClay.dc.html", direction("Warm clay", "#835C4B", "#F4E4DD", "The same stone neutrals with a terracotta accent. Warmer and more domestic, further from anything clinical &mdash; but it sits close to the colour the app uses for going over."));
out("DirectionMist.dc.html", direction("Quiet blue", "#456C84", "#DCEAF4", "The smallest step from where the app is now: today&#39;s blue, drained of its brightness. Safest, and the least distinctive of the three."));
