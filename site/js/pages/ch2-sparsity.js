import "../layout.js";
import { h, figure, slider, select, stats, dataTable, color, onThemeChange, tooltip } from "../lib/ui.js";
import { Plot, fnSeries } from "../lib/plot.js";
import { loadNetworks, loadCollabExtra, NETWORK_ORDER, SHORT } from "../lib/data.js";
import { fmt, arrMax } from "../lib/stats.js";

const tip = tooltip();

// ------------------------------------------------------------------ 1. L versus N
(async () => {
  const { networks } = await loadNetworks();
  const f = figure("#fig-lvn", { title: "Number of links versus number of nodes", sub: "The book's eight networks (as undirected, simple networks)." });
  const p = new Plot(f.body, { height: 340, x: { type: "log", label: "number of nodes N", min: 300, max: 2e6 }, y: { type: "log", label: "number of links L", min: 100, max: 1e12 } });
  const nets = NETWORK_ORDER.map((n) => networks[n]);
  const LABEL_POS = { protein: { dx: 8, dy: 14 }, powergrid: { dx: 8, dy: -6 }, collaboration: { anchor: "end", dx: -8, dy: -8 }, phonecalls: { dx: 2, dy: 17 }, email: { dx: 6, dy: -9 } };
  const lines = [1, 10, 100].map((k) => fnSeries((N) => (k * N) / 2, 300, 2e6, 2, { log: true, color: "random", thin: true, label: `⟨k⟩ = ${k}`, legend: false, tooltip: false, table: false }));
  p.update({
    series: [
      fnSeries((N) => (N * (N - 1)) / 2, 300, 2e6, 60, { log: true, color: "theory", dashed: true, label: "L_max = N(N−1)/2 (complete graph)", tooltip: false }),
      ...lines,
      { id: "real", type: "scatter", data: nets.map((d) => [d.N, d.L, d]), color: 1, label: "real networks", r: 5,
        tooltip: (d) => [h("div", { class: "tt-title" }, d[2].description), h("div", {}, `N = ${fmt.int(d[2].N)}, L = ${fmt.int(d[2].L)}`), h("div", {}, `⟨k⟩ = ${fmt.fix(d[2].avgk, 2)}, density = ${fmt.exp((2 * d[2].L) / (d[2].N * (d[2].N - 1)), 1)}`)] },
    ],
    annotations: [
      // Collaboration, phone calls and email sit close together: put one label above, one below, one to the right.
      ...nets.map((d) => ({ x: d.N, y: d.L, text: SHORT[d.name], ...(LABEL_POS[d.name] || { dx: 8, dy: 4 }) })),
      ...[1, 10, 100].map((k) => ({ x: 1.6e6, y: (k * 1.6e6) / 2, text: `⟨k⟩ = ${k}`, anchor: "end", dy: -6 })),
      { x: 2.2e3, y: (2.2e3 * 2.2e3) / 2, text: "L_max", anchor: "end", dx: -6, dy: -8 },
    ],
    xName: "N", yFormat: (v) => fmt.int(v),
  });
  const rows = nets.map((d) => [d.description, d.N, d.L, (d.N * (d.N - 1)) / 2, (2 * d.L) / (d.N * (d.N - 1))]);
  f.body.append(dataTable([
    { label: "Network", align: "left" }, { label: "N", format: fmt.int }, { label: "L", format: fmt.int },
    { label: "L_max = N(N−1)/2", format: (v) => fmt.exp(v, 2) }, { label: "density L/L_max", format: (v) => fmt.exp(v, 1) },
  ], rows));
})();

// ------------------------------------------------------------------ 2. spy plots of the collaboration matrix
(async () => {
  const extra = await loadCollabExtra();
  const f = figure("#fig-spy", { title: "The collaboration network's adjacency matrix", sub: "Each non-zero entry Aᵢⱼ = 1 is a dot; white is zero.", cols: "cols-2" });
  const pa = f.panel("Whole matrix: each pixel is a 116 × 116 block, shaded by its share of non-zeros (full colour = 1%)");
  const pb = f.panel("Zoom: the first 1,000 × 1,000 entries, every non-zero shown");
  const ca = h("canvas", { style: { width: "100%", aspectRatio: "1", border: "1px solid var(--border)", borderRadius: "6px", background: "var(--surface)" } });
  const cb = h("canvas", { style: { width: "100%", aspectRatio: "1", border: "1px solid var(--border)", borderRadius: "6px", background: "var(--surface)" } });
  pa.append(ca); pb.append(cb);
  const B = extra.image.bins, counts = extra.image.counts;
  const maxC = arrMax(counts);
  const blockEdges = extra.block.edges;
  const nnzBlock = 2 * blockEdges.length;
  const draw = () => {
    // whole matrix: shade by log(count)
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = ca.clientWidth || 400;
    ca.width = ca.height = Math.round(W * dpr);
    let ctx = ca.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, W);
    const cell = W / B, block = (23133 / B) ** 2;
    // shade = fraction of the block's entries that are non-zero; full colour = 1%
    ctx.fillStyle = color("s1");
    for (let i = 0; i < B; i++) for (let j = 0; j < B; j++) {
      const c = counts[i * B + j];
      if (!c) continue;
      ctx.globalAlpha = Math.min(1, c / block / 0.01);
      ctx.fillRect(j * cell, i * cell, Math.ceil(cell), Math.ceil(cell));
    }
    ctx.globalAlpha = 1;
    const W2 = cb.clientWidth || 400;
    cb.width = cb.height = Math.round(W2 * dpr);
    ctx = cb.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W2, W2);
    ctx.fillStyle = color("s1");
    const sc = W2 / 1000;
    for (const [u, v] of blockEdges) {
      ctx.fillRect(v * sc - 1, u * sc - 1, 2.4, 2.4);
      ctx.fillRect(u * sc - 1, v * sc - 1, 2.4, 2.4);
    }
  };
  requestAnimationFrame(draw);
  new ResizeObserver(() => draw()).observe(pa);
  onThemeChange(draw);
  ca.addEventListener("pointermove", (ev) => {
    const r = ca.getBoundingClientRect();
    const j = Math.floor(((ev.clientX - r.left) / r.width) * B), i = Math.floor(((ev.clientY - r.top) / r.height) * B);
    if (i < 0 || j < 0 || i >= B || j >= B) return;
    const c = counts[i * B + j];
    tip.show(ev.clientX, ev.clientY, h("div", {}, h("b", {}, `${c} non-zeros`), ` in this block of ${Math.round(23133 / B)}² ≈ ${fmt.int((23133 / B) ** 2)} entries`));
  });
  ca.addEventListener("pointerleave", () => tip.hide());
  const sorted = counts.slice().sort((a, b) => a - b);
  f.caption.textContent = `Left: the typical block holds ${sorted[sorted.length >> 1]} non-zeros out of about 13,400 entries; the densest holds ${maxC} (${fmt.pct(maxC / (23133 / B) ** 2, 1)}). Drawn at its true density the matrix is almost white. (Plots of large networks usually enlarge the dots, as the notebook does, which makes them look much denser than they are.) Right: ${nnzBlock} non-zero entries out of 1,000,000 (${fmt.pct(1 - nnzBlock / 1e6, 2)} zeros), mirrored about the diagonal because the network is undirected (Aᵢⱼ = Aⱼᵢ).`;
})();

// ------------------------------------------------------------------ 3. memory calculator
{
  const f = figure("#fig-memory", { title: "What does it cost to store a network?", sub: "Bytes needed by each representation; the vertical axis is logarithmic." , cols: "split-r"});
  const left = f.panel(null), right = f.panel(null);
  let N = 23133, k = 8.08;
  const PRESETS = {
    karate: [34, 4.59, "Karate club"], collaboration: [23133, 8.08, "Science collaboration"], www: [325729, 6.69, "WWW sample (undirected)"],
    big: [3e9, 200, "N = 3×10⁹, ⟨k⟩ = 200 (a Facebook-sized illustration)"],
  };
  select(f.controls, {
    label: "Preset", value: "collaboration", options: Object.entries(PRESETS).map(([v, [, , l]]) => ({ value: v, label: l })),
    onChange: (v) => { [N, k] = PRESETS[v]; sN.value = N; sk.value = k; update(); },
  });
  const sN = slider(f.controls, { label: "nodes N", min: 10, max: 1e10, value: N, log: true, step: 1, format: (v) => (v < 1e6 ? fmt.int(v) : fmt.exp(v, 1)), onInput: (v) => { N = v; update(); }, wide: true });
  const sk = slider(f.controls, { label: "average degree ⟨k⟩", min: 1, max: 1000, value: k, log: true, step: 0.01, format: (v) => fmt.sig(v, 3), onInput: (v) => { k = v; update(); }, wide: true });
  const t = stats(left, [
    { key: "L", label: "links L = N⟨k⟩/2" }, { key: "Lmax", label: "possible links L_max" }, { key: "dens", label: "density" },
    { key: "f64", label: "dense, 8 bytes/entry (NumPy default)" }, { key: "bits", label: "dense matrix, 1 bit/entry" },
    { key: "el", label: "edge list" }, { key: "csr", label: "sparse matrix (CSR)" },
  ]);
  const plot = new Plot(right, {
    height: 280, legend: false, table: true, margin: { top: 12, right: 18, bottom: 42, left: 74 },
    x: { label: "representation", tickValues: [1, 2, 3, 4], format: (v) => ["", "dense, 8 B", "dense, 1 bit", "edge list", "CSR"][v] || "", min: 0.4, max: 4.6, zero: false },
    y: { type: "log", label: "bytes", format: (v) => bytes(v) },
  });
  function bytes(b) {
    const u = ["B", "kB", "MB", "GB", "TB", "PB", "EB", "ZB"];
    let i = 0;
    while (b >= 1000 && i < u.length - 1) { b /= 1000; i++; }
    return (b >= 100 ? Math.round(b) : +b.toPrecision(2)) + " " + u[i];
  }
  function update() {
    const L = (N * k) / 2, Lmax = (N * (N - 1)) / 2;
    const idx = N < 2 ** 31 ? 4 : 8;
    const m = { f64: N * N * 8, bits: (N * N) / 8, el: 2 * L * idx, csr: (N + 1) * 8 + 2 * L * idx };
    t.set("L", fmt.sig(L, 3)); t.set("Lmax", fmt.sig(Lmax, 3)); t.set("dens", fmt.exp(Math.min(1, L / Lmax), 1));
    t.set("bits", bytes(m.bits)); t.set("f64", bytes(m.f64)); t.set("el", bytes(m.el), `${idx}-byte node ids`); t.set("csr", bytes(m.csr));
    plot.update({
      series: [{ type: "bar", data: [[1, m.f64], [2, m.bits], [3, m.el], [4, m.csr]], color: 1, label: "memory", format: (v) => bytes(v) }],
      xName: "representation", xFormat: (v) => ["", "dense, 8 bytes per entry", "dense, 1 bit per entry", "edge list", "sparse (CSR)"][v],
      rules: [{ y: 16e9, label: "16 GB: a laptop's memory", dashed: true, align: "left" }],
    });
  }
  update();
  f.setCaption("Dense storage grows like $N^2$ whatever the network; sparse storage grows like $L$. A dense matrix stops fitting in a laptop's memory at $N \\approx 4.5\\times10^4$ (8-byte entries) or $N \\approx 3.6\\times10^5$ (bits), while an edge list of a billion links still fits.");
}
