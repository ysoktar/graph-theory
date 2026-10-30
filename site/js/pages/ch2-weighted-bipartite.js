import "../layout.js";
import { h, figure, slider, segmented, stats, tooltip } from "../lib/ui.js";
import { LANG } from "../i18n.js";

const TR = LANG === "tr";
import { NetView, layouts } from "../lib/netview.js";
import { MatrixView } from "../lib/matrixview.js";
import { Plot } from "../lib/plot.js";
import { loadClassic } from "../lib/data.js";
import { Graph, components } from "../lib/graph.js";
import { fmt } from "../lib/stats.js";

const tip = tooltip();
const classic = loadClassic();

// ------------------------------------------------------------------ 1. weighted karate club
(async () => {
  const { karate } = await classic;
  const N = karate.nodes.length;
  const hi = karate.nodes.map((v) => v.club === "Mr. Hi");
  const W = new Map(karate.edges.map(([u, v, w]) => [Math.min(u, v) + "," + Math.max(u, v), w]));
  const w = (u, v) => W.get(Math.min(u, v) + "," + Math.max(u, v)) || 0;
  const full = Graph.fromEdges(N, karate.edges.map(([u, v]) => [u, v]));
  const strength = Array.from({ length: N }, (_, i) => full.neighbors(i).reduce((s, j) => s + w(i, j), 0));
  let t = 1;
  const f = figure("#fig-weighted", { title: "The karate club with link weights", sub: "Link width shows the weight. Drag the threshold to keep only the stronger links.", cols: "split" });
  const pn = f.panel(null), pr = f.panel(null);
  const nv = new NetView(pn, {
    height: 400, charge: -90, linkDistance: 42,
    nodeRadius: (i) => 3.5 + 0.9 * Math.sqrt(strength[i]) * 1.4,
    nodeColor: (i) => (hi[i] ? "s1" : "s2"),
    edgeColor: (u, v) => (w(u, v) < t ? null : hi[u] !== hi[v] ? "text-2" : "axis"),
    edgeWidth: (u, v) => 0.6 + 0.9 * w(u, v),
    tooltip: (i) => `member ${i} · degree ${full.degree(i)} · strength ${strength[i]}`,
    legend: [{ label: "Mr. Hi's faction", color: "s1" }, { label: "President's faction", color: "s2" }, { label: "link across factions", color: "text-2" }],
  });
  nv.setGraph(full);
  const tiles = stats(pr, [{ key: "L", label: "links kept" }, { key: "x", label: "across factions" }, { key: "c", label: "groups (≥ 2 members)" }]);
  const plot = new Plot(pr, { height: 250, x: { label: "degree kᵢ", min: 0 }, y: { label: "strength sᵢ" } });
  const meanW = karate.edges.reduce((s, e) => s + e[2], 0) / karate.edges.length;
  plot.update({
    series: [
      { type: "scatter", data: full.degrees().reduce((a, k, i) => (a.push([k, strength[i], i]), a), []), color: 1, label: "members", tooltip: (d) => `member ${d[2]}: k = ${d[0]}, s = ${d[1]}` },
      { type: "line", data: [[0, 0], [18, 18 * meanW]], color: "theory", dashed: true, label: `s = ⟨w⟩ k (⟨w⟩ = ${meanW.toFixed(2)})` },
    ],
    xName: "k",
  });
  function update() {
    const kept = karate.edges.filter((e) => e[2] >= t);
    const g = Graph.fromEdges(N, kept.map(([u, v]) => [u, v]));
    const c = components(g);
    tiles.set("L", kept.length, `of ${karate.edges.length}`);
    tiles.set("x", kept.filter(([u, v]) => hi[u] !== hi[v]).length);
    tiles.set("c", c.sizes.filter((s) => s > 1).length, `${TR ? "boyutlar" : "sizes"} ${c.sizes.filter((s) => s > 1).sort((a, b) => b - a).join(", ")}`);
    nv.redraw();
  }
  slider(f.controls, { label: "keep links with weight ≥", min: 1, max: 7, step: 1, value: 1, onInput: (v) => { t = v; update(); }, wide: true });
  update();
})();

// ------------------------------------------------------------------ 2. Southern Women: bipartite network and projections
const davisReady = classic.then(({ southernWomen: sw }) => {
  const nW = sw.women.length, nE = sw.events.length;
  const B = Array.from({ length: nW }, () => new Array(nE).fill(0));
  for (const [i, e] of sw.edges) B[i][e] = 1;
  const proj = (rows) => rows.map((r, i) => rows.map((q, j) => (i === j ? r.reduce((a, b) => a + b, 0) : r.reduce((s, x, k) => s + x * q[k], 0))));
  const BT = Array.from({ length: nE }, (_, e) => B.map((r) => r[e]));
  return { sw, nW, nE, B, WW: proj(B), WE: proj(BT) };
});

(async () => {
  const { sw, nW, nE, B, WW, WE } = await davisReady;
  let view = "bipartite", t = 1, sel = -1;
  const f = figure("#fig-bipartite", { title: "Southern Women: the bipartite network and its projections", sub: "Click a node to highlight its neighbours. Women are numbered 1–18, events E1–E14." });
  const nv = new NetView(f.body, {
    height: 420, charge: -160, linkDistance: 60,
    nodeRadius: (i) => (view === "bipartite" ? 10 : 9),
    nodeColor: (i) => {
      const isEvent = view === "events" || (view === "bipartite" && i >= nW);
      if (sel >= 0 && i !== sel && !neighbors(sel).has(i)) return "surface-3";
      return isEvent ? "s2" : "s1";
    },
    nodeRing: (i) => (i === sel ? "text" : null),
    edgeColor: (u, v) => (sel >= 0 && u !== sel && v !== sel ? "grid" : "axis"),
    edgeWidth: (u, v) => (view === "bipartite" ? 1.4 : 0.6 + 1.1 * weight(u, v)),
    label: (i) => (view === "bipartite" ? (i < nW ? String(i + 1) : "E" + (i - nW + 1)) : view === "women" ? String(i + 1) : "E" + (i + 1)),
    labelInside: () => true, labelSize: 9.5,
    tooltip: (i) => describe(i),
    onClick: (i) => { sel = sel === i ? -1 : i; nv.redraw(); showSelection(); },
    onBackgroundClick: () => { sel = -1; nv.redraw(); showSelection(); },
    legend: [{ label: "women", color: "s1" }, { label: "events", color: "s2" }],
  });
  const tiles = stats(f.body, [{ key: "n", label: "nodes" }, { key: "L", label: "links" }, { key: "d", label: "density" }, { key: "s", label: "selected" }]);
  let edges = [];
  function weight(u, v) {
    if (view === "women") return WW[u][v];
    if (view === "events") return WE[u][v];
    return 1;
  }
  function neighbors(i) {
    const s = new Set();
    for (const [u, v] of edges) { if (u === i) s.add(v); if (v === i) s.add(u); }
    return s;
  }
  function describe(i) {
    if (view === "bipartite") {
      if (i < nW) return `${i + 1}. ${sw.women[i]}: ${B[i].reduce((a, b) => a + b, 0)} ${TR ? "etkinlik" : "events"}`;
      const e = i - nW;
      return `E${e + 1} (${sw.events[e]}): ${B.reduce((s, r) => s + r[e], 0)} ${TR ? "kadın" : "women"}`;
    }
    if (view === "women") return TR ? `${i + 1}. ${sw.women[i]}: ${neighbors(i).size} kadına bağlı` : `${i + 1}. ${sw.women[i]}: linked to ${neighbors(i).size} women`;
    return TR ? `E${i + 1} (${sw.events[i]}): ${neighbors(i).size} etkinliğe bağlı` : `E${i + 1} (${sw.events[i]}): linked to ${neighbors(i).size} events`;
  }
  function build() {
    sel = -1;
    if (view === "bipartite") {
      edges = sw.edges.map(([i, e]) => [i, nW + e]);
      const pos = layouts.bipartite(nW, nE, 900, 300).map(([x, y], i) => (i >= nW ? [70 + x * (760 / 900), y] : [x, y]));
      nv.setGraph({ n: nW + nE, edges }, { positions: pos });
      tiles.set("n", `${nW} + ${nE}`, "women + events"); tiles.set("L", edges.length, "attendances");
      tiles.set("d", fmt.fix(edges.length / (nW * nE), 2), "L / (|U|·|V|)");
    } else {
      const Wm = view === "women" ? WW : WE, n = Wm.length;
      edges = [];
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Wm[i][j] >= t) edges.push([i, j]);
      nv.setGraph({ n, edges }, { keep: false });
      tiles.set("n", n); tiles.set("L", edges.length, t > 1 ? `weight ≥ ${t}` : "shared ≥ 1");
      tiles.set("d", fmt.fix((2 * edges.length) / (n * (n - 1)), 2), "L / L_max");
    }
    tiles.set("s", "–", "click a node");
    thr.el.style.display = view === "bipartite" ? "none" : "";
  }
  segmented(f.controls, {
    label: "Show", value: "bipartite",
    options: [{ value: "bipartite", label: "Bipartite network" }, { value: "women", label: "Projection onto women" }, { value: "events", label: "Projection onto events" }],
    onChange: (v) => { view = v; build(); },
  });
  const thr = slider(f.controls, { label: "keep projected links with weight ≥", min: 1, max: 8, step: 1, value: 1, onInput: (v) => { t = v; build(); }, wide: true });
  function showSelection() {
    if (sel < 0) { tiles.set("s", "–", "click a node"); return; }
    const isEvent = view === "events" || (view === "bipartite" && sel >= nW);
    const label = isEvent ? "E" + ((view === "bipartite" ? sel - nW : sel) + 1) : String(sel + 1);
    tiles.set("s", label, `${neighbors(sel).size} neighbours`);
  }
  build();
  f.setCaption((TR ? "İzdüşümlerde bağlantı kalınlığı ağırlığı gösterir: ortak etkinliklerin (kadınlar için) ya da ortak katılımcıların (etkinlikler için) sayısı. Eşik 1 olduğunda, herhangi bir örtüşmesi olan her çift bağlanır." : "In the projections, link width shows the weight: the number of shared events (women) or shared attendees (events). With threshold 1 every pair with any overlap is linked."));
})();

// ------------------------------------------------------------------ 3. the matrices
(async () => {
  const { sw, nW, nE, B, WW } = await davisReady;
  const f = figure("#fig-biadj", { title: "B and its projection W = B Bᵀ", sub: "Hover a cell. Darker blue = larger weight.", cols: "cols-2" });
  const pb = f.panel("Biadjacency matrix B (18 women × 14 events)"), pw = f.panel("Projection W = B Bᵀ (18 × 18), diagonal = events attended");
  const maxW = Math.max(...WW.flat());
  const ramp = ["blue-1", "blue-2", "blue-3", "blue-4", "blue-5", "blue-6"];
  new MatrixView(pb, {
    rows: nW, cols: nE, maxSize: 360, labels: true, rowLabel: (i) => i + 1, colLabel: (j) => j + 1,
    cell: (i, j) => (B[i][j] ? "s1" : null),
    onHover: (i, j, ev) => { if (i == null) return tip.hide(); tip.show(ev.clientX, ev.clientY, (TR ? `${sw.women[i]}: E${j + 1} (${sw.events[j]}) etkinliğine ${B[i][j] ? "katıldı" : "katılmadı"}` : `${sw.women[i]} ${B[i][j] ? "attended" : "did not attend"} event E${j + 1} (${sw.events[j]})`)); },
  });
  new MatrixView(pw, {
    rows: nW, cols: nW, maxSize: 360, labels: true, rowLabel: (i) => i + 1, colLabel: (j) => j + 1,
    cell: (i, j) => (WW[i][j] ? ramp[Math.min(5, Math.floor((WW[i][j] / (maxW + 1)) * 6))] : null),
    onHover: (i, j, ev) => {
      if (i == null) return tip.hide();
      tip.show(ev.clientX, ev.clientY, i === j ? (TR ? `W${i + 1},${i + 1} = ${WW[i][i]}: katıldığı etkinlik sayısı (${sw.women[i]})` : `W${i + 1},${i + 1} = ${WW[i][i]}: events attended by ${sw.women[i]}`) : (TR ? `W = ${WW[i][j]}: ortak etkinlik sayısı (${short2(sw.women[i])}, ${short2(sw.women[j])})` : `W = ${WW[i][j]}: events shared by ${short2(sw.women[i])} and ${short2(sw.women[j])}`));
    },
  });
  f.setCaption((TR ? "$W$'nin her öğesi $B$'nin iki satırının iç çarpımıdır: $W_{uv} = \\sum_e B_{ue}B_{ve}$. $W$'nin blok yapısı (çoğunlukla farklı etkinliklere katılan iki kadın grubu), nereye bakacağınızı bildiğinizde $B$'de zaten görülür." : "Each entry of $W$ is a dot product of two rows of $B$: $W_{uv} = \\sum_e B_{ue}B_{ve}$. The block structure of $W$ (two groups of women who mostly attend different events) is already visible in $B$ once you know where to look."));
})();
function short2(name) { return name.split(" ")[0]; }
