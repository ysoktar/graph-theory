import "../layout.js";
import { h, figure, slider, select, button, stats, dataTable } from "../lib/ui.js";
import { NetView, layouts } from "../lib/netview.js";
import { Plot } from "../lib/plot.js";
import { RNG } from "../lib/rng.js";
import { Graph, trySwap, clusteringSummary, assortativity } from "../lib/graph.js";
import { hurwitzZeta, fmt } from "../lib/stats.js";
import { karateGraph, loadNetworks, loadRealGraph, NETWORK_ORDER, WITH_EDGES } from "../lib/data.js";
import { run } from "../lib/compute.js";
import { t as tl, LANG } from "../i18n.js";

// ------------------------------------------------------------------ 1. the configuration model, stub by stub
{
  const degrees = [5, 4, 3, 3, 2, 2, 2, 1, 1, 1];
  const N = degrees.length, pos = layouts.circle(N, 170);
  let seed = 1, stubs = [], paired = 0;
  const f = figure("#fig-stubs", { title: "The configuration model, one pair of stubs at a time", sub: `Degree sequence ${degrees.join(", ")}: each node gets kᵢ stubs; stubs are paired uniformly at random.`, cols: "split" });
  const pn = f.panel(null), pr = f.panel(null);
  let edges = [];
  const free = new Int32Array(N);
  const nv = new NetView(pn, {
    height: 360, toolbar: false, drag: false,
    nodeRadius: (i) => 9 + 1.5 * degrees[i], nodeColor: () => "s1",
    label: (i) => (free[i] ? `${free[i]}` : ""), labelInside: () => true, labelColor: () => "surface",
    edgeColor: (u, v, e) => (edges[e]?.bad ? "s2" : "text-2"), edgeWidth: (u, v, e) => (edges[e]?.bad ? 2.4 : 1.6),
    tooltip: (i) => `node ${i}: degree ${degrees[i]}, ${free[i]} stubs still free`,
  });
  const t = stats(pr, [{ key: "p", label: "pairs formed" }, { key: "self", label: "self-loops" }, { key: "multi", label: "repeated links" }, { key: "L", label: "links in the simple graph" }]);
  const log = h("div", { class: "small muted", style: { marginTop: "8px" } });
  pr.append(log);
  function reset() {
    const rng = new RNG(seed);
    stubs = [];
    degrees.forEach((k, i) => { for (let j = 0; j < k; j++) stubs.push(i); });
    rng.shuffle(stubs);
    paired = 0; render();
  }
  function render() {
    free.set(degrees);
    edges = [];
    const seen = new Set();
    let self = 0, multi = 0;
    for (let p = 0; p < paired; p++) {
      const u = stubs[2 * p], v = stubs[2 * p + 1];
      free[u]--; free[v]--;
      const key = Math.min(u, v) * N + Math.max(u, v);
      const bad = u === v || seen.has(key);
      if (u === v) self++; else if (seen.has(key)) multi++;
      seen.add(key);
      if (u !== v) edges.push({ u, v, bad });
    }
    nv.setGraph({ n: N, edges: edges.map((e) => [e.u, e.v]) }, { positions: pos });
    t.set("p", `${paired} of ${stubs.length / 2}`); t.set("self", self); t.set("multi", multi); t.set("L", seen.size - self);
    log.textContent = paired ? `Last pair: stub of node ${stubs[2 * paired - 2]} with stub of node ${stubs[2 * paired - 1]}${stubs[2 * paired - 2] === stubs[2 * paired - 1] ? " (a self-loop)" : ""}.` : "Numbers inside the nodes are their free stubs.";
  }
  const row = h("div", { class: "btn-row" });
  f.controls.append(row);
  button(row, { label: "Pair two stubs", icon: "step", onClick: () => { if (paired < stubs.length / 2) { paired++; render(); } } });
  button(row, { label: "Pair all", onClick: () => { paired = stubs.length / 2; render(); } });
  button(row, { label: "New shuffle", icon: "dice", onClick: () => { seed++; reset(); } });
  reset();
  f.setCaption("Orange links repeat a link that already exists; self-loops are counted but not drawn. Removing both (as the notebook does) gives a simple graph whose degrees are slightly smaller than requested, mostly for the hubs. In large sparse networks such defects are rare unless the degree distribution is very heavy-tailed.");
}

// ------------------------------------------------------------------ 2. degree-preserving swaps on the karate club
(async () => {
  const { graph: K0 } = await karateGraph();
  let g = K0.clone(), edgesList = g.edges(), last = null, total = 0, rng = new RNG(5);
  const f = figure("#fig-swap", { title: "Degree-preserving randomization", sub: "Pick links A–B and C–D at random and rewire them to A–D and C–B, unless that would create a self-loop or a repeated link. Every node keeps its degree.", cols: "split" });
  const pn = f.panel(null), pr = f.panel(null);
  const key = (u, v) => Math.min(u, v) + "," + Math.max(u, v);
  let addedSet = new Set();
  const nv = new NetView(pn, {
    height: 380, charge: -90, linkDistance: 40,
    nodeRadius: (v) => 5 + 1.1 * g.degree(v), nodeColor: (v) => (last && [last.added[0][0], last.added[0][1], last.added[1][0], last.added[1][1]].includes(v) ? "s2" : "s1"),
    edgeColor: (u, v) => (addedSet.has(key(u, v)) ? "s2" : "axis"), edgeWidth: (u, v) => (addedSet.has(key(u, v)) ? 2.6 : 1),
    tooltip: (v) => `member ${v}: degree ${g.degree(v)} (always ${K0.degree(v)})`,
  });
  nv.setGraph(g);
  const t = stats(pr, [{ key: "s", label: "swaps done" }, { key: "C", label: "⟨C⟩" }, { key: "r", label: "assortativity r" }, { key: "deg", label: "degrees unchanged" }]);
  const plot = new Plot(pr, { height: 180, x: { label: "swaps / L", min: 0 }, y: { label: "⟨C⟩", min: 0, max: 0.65 } });
  const curve = [[0, clusteringSummary(g).avg]];
  function show() {
    addedSet = new Set(last ? last.added.map(([a, b]) => key(a, b)) : []);
    nv.setGraph(g, { keep: true, alpha: 0.05 });
    const C = clusteringSummary(g).avg;
    t.set("s", fmt.int(total), `${(total / g.m).toFixed(2)} × L`); t.set("C", fmt.fix(C, 3), `real: ${fmt.fix(clusteringSummary(K0).avg, 3)}`); t.set("r", fmt.fix(assortativity(g), 3), `real: ${fmt.fix(assortativity(K0), 3)}`);
    t.set("deg", [...Array(g.n).keys()].every((v) => g.degree(v) === K0.degree(v)) ? "yes" : "NO");
    plot.update({ series: [{ type: "line", markers: true, data: curve, color: 1, label: "⟨C⟩" }], x: { min: 0, max: Math.max(2, curve[curve.length - 1][0]) }, xName: "swaps / L", yFormat: (v) => fmt.fix(v, 3) });
  }
  const swapN = (n) => { let done = 0, tries = 0; while (done < n && tries < 50 * n) { tries++; const s = trySwap(g, edgesList, rng); if (s) { done++; last = s; } } total += done; curve.push([total / g.m, clusteringSummary(g).avg]); show(); };
  const row = h("div", { class: "btn-row" });
  f.controls.append(row);
  button(row, { label: "One swap", icon: "step", onClick: () => swapN(1) });
  button(row, { label: "10 swaps", onClick: () => swapN(10) });
  button(row, { label: "Up to 2L swaps", onClick: () => swapN(Math.max(0, 2 * g.m - total)) });
  button(row, { label: "Reset", icon: "reset", onClick: () => { g = K0.clone(); edgesList = g.edges(); last = null; total = 0; rng = new RNG(5); curve.length = 1; show(); } });
  show();
  f.setCaption("The orange links are the two created by the last swap. After about L swaps most of the original wiring is gone; the notebook's 2L is enough for ⟨C⟩ to settle (we checked up to 12L on the collaboration network).");
})();

// ------------------------------------------------------------------ 3. randomize a real network (worker, notebook cell 70)
(async () => {
  const { networks } = await loadNetworks();
  let name = "collaboration", job = null;
  const f = figure("#fig-real", { title: "What does the degree sequence explain?", sub: "The real network against its degree-preserving randomization (2L swaps) and against G(N, L)." });
  const status = h("div", { class: "status-line" });
  const host = h("div");
  f.body.append(host);
  const plot = new Plot(f.body, { height: 200, x: { label: "swaps done / L", min: 0 }, y: { type: "log", label: "⟨C⟩" } });
  async function go() {
    if (job) job.cancel();
    const d = networks[name];
    host.replaceChildren();
    status.textContent = LANG === "tr" ? `${tl(d.description)} yükleniyor…` : `Loading ${d.description}…`;
    const g = await loadRealGraph(name);
    const pairs = new Int32Array(2 * g.m);
    let p = 0;
    for (const [u, v] of g.edges()) { pairs[p++] = u; pairs[p++] = v; }
    status.textContent = "Swapping…";
    job = run("randomize", { n: g.n, pairs, factor: 2, seed: 3, sources: 80 }, (m) => {
      if (m.phase === "swapping") {
        status.textContent = `${fmt.int(m.done)} of ${fmt.int(m.total)} swaps`;
        plot.update({ series: [{ type: "line", markers: true, data: m.curve.map((c) => [c.swaps / g.m, c.C]), color: 1, label: "⟨C⟩ during randomization" }], xName: "swaps / L", yFormat: (v) => fmt.sig(v, 3) });
      }
    });
    let res;
    try { res = await job.promise; } catch { return; }
    job = null;
    status.textContent = `Done: ${fmt.int(res.swaps)} swaps, degrees preserved: ${res.degreesPreserved ? "yes" : "no"}.`;
    const er = d.nullModels.er, b = res.before, a = res.after;
    const rows = [
      ["⟨k²⟩", fmt.sig(d.k2, 4), fmt.sig(d.k2, 4), fmt.sig(er.k2, 4)],
      ["k_max", fmt.int(d.kmax), fmt.int(d.kmax), fmt.int(er.kmax)],
      ["giant component N_G/N", fmt.pct(b.giant, 1), fmt.pct(a.giant, 1), fmt.pct(er.giant, 1)],
      ["⟨d⟩ (from 80 start nodes)", fmt.fix(b.d, 2), fmt.fix(a.d, 2), fmt.fix(er.avgd, 2)],
      ["⟨C⟩", fmt.sig(b.C, 3), fmt.sig(a.C, 3), fmt.sig(er.C, 3)],
      ["assortativity r", fmt.fix(b.r, 3), fmt.fix(a.r, 3), fmt.fix(er.r, 3)],
    ];
    host.replaceChildren(dataTable([{ label: "Property", align: "left" }, { label: `${tl(d.description)} (${tl("real")})` }, { label: "degree-preserving randomization" }, { label: "G(N, L)" }], rows));
  }
  select(f.controls, { label: "Network", value: name, options: WITH_EDGES.map((n) => ({ value: n, label: networks[n].description })), onChange: (v) => { name = v; go(); } });
  f.controls.append(status);
  go();
  f.setCaption("The randomized network keeps k_max and ⟨k²⟩ exactly, which G(N, L) cannot. What it does not keep tells us what the degree sequence does not explain: here, most of the clustering and the degree correlations.");

  // ---- configuration-model clustering for all eight (N19)
  const rows = NETWORK_ORDER.map((n) => {
    const d = networks[n], c = d.nullModels.configuration;
    const pred = Math.pow(d.k2 - d.avgk, 2) / (Math.pow(d.avgk, 3) * d.N);
    return [d.description, d.clustering.avg, c.C, c.C / d.clustering.avg, Math.min(1, pred), d.nullModels.er.C];
  });
  document.getElementById("tbl-cfg").append(dataTable([
    { label: "Network", align: "left" }, { label: "real ⟨C⟩", format: (v) => fmt.sig(v, 3) }, { label: "configuration model ⟨C⟩", format: (v) => fmt.sig(v, 3) },
    { label: "share of the real value", format: (v) => fmt.pct(v, 1) }, { label: "(⟨k²⟩ − ⟨k⟩)² / (⟨k⟩³ N)", format: (v) => fmt.sig(v, 3) }, { label: "G(N, L) ⟨C⟩", format: (v) => fmt.sig(v, 3) },
  ], rows, { highlight: (r) => r[3] > 0.2 }));
})();

// ------------------------------------------------------------------ 4. sampling degrees: rounding versus exact (N3)
{
  let gamma = 2.5, kmin = 1;
  const f = figure("#fig-sampler", { title: "Drawing power-law degrees: exact versus rounding", sub: "P(K = k) of the exact discrete power law and of the rounding shortcut k = ⌊(k_min − ½)(1 − u)^(−1/(γ−1)) + ½⌋ used by the notebook's helper." });
  const t = stats(f.body, [{ key: "e", label: "exact P(K = k_min)" }, { key: "r", label: "rounding P(K = k_min)" }, { key: "m", label: "fitted γ of a huge rounded sample" }]);
  const plot = new Plot(f.body, { height: 260, x: { type: "log", label: "degree k" }, y: { type: "log", label: "P(K = k)" } });
  function draw() {
    const z = hurwitzZeta(gamma, kmin);
    const ex = (k) => Math.pow(k, -gamma) / z;
    const S = (k) => Math.pow((k - 0.5) / (kmin - 0.5), 1 - gamma); // rounding: P(K ≥ k)
    const ro = (k) => S(k) - S(k + 1);
    const ks = [];
    for (let k = kmin; k <= 1000; k = k < 20 ? k + 1 : Math.ceil(k * 1.15)) ks.push(k);
    // MLE of the rounded distribution's expected log-likelihood: maximise Σ_k ro(k) ln ex_γ'(k)
    let mean = 0;
    for (let k = kmin; k < 200000; k++) { const p = ro(k); if (p < 1e-16) break; mean += p * Math.log(k); }
    let lo = 1.05, hi = 8;
    const ll = (g) => -Math.log(hurwitzZeta(g, kmin)) - g * mean;
    for (let i = 0; i < 80; i++) { const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3; if (ll(a) < ll(b)) lo = a; else hi = b; }
    t.set("e", fmt.fix(ex(kmin), 4)); t.set("r", fmt.fix(ro(kmin), 4), `${((ro(kmin) / ex(kmin) - 1) * 100).toFixed(1)}%`); t.set("m", fmt.fix((lo + hi) / 2, 3), `true γ = ${gamma.toFixed(2)}`);
    plot.update({
      series: [
        { type: "scatter", data: ks.map((k) => [k, ex(k)]), color: 1, label: "exact", r: 3.5 },
        { type: "scatter", data: ks.map((k) => [k, ro(k)]), color: 2, symbol: "diamond", label: "rounding shortcut", r: 3.5 },
      ],
      xName: "k", yFormat: (v) => fmt.sig(v, 4),
    });
  }
  slider(f.controls, { label: "γ", min: 2.05, max: 3.5, step: 0.05, value: gamma, format: (v) => v.toFixed(2), onInput: (v) => { gamma = v; draw(); } });
  slider(f.controls, { label: "k_min", min: 1, max: 10, step: 1, value: kmin, onInput: (v) => { kmin = v; draw(); } });
  draw();
  f.setCaption("The shortcut is the continuous power law rounded to the nearest integer. It puts too much weight on k_min when k_min is small, so a large sample drawn with it has a fitted exponent above the intended one. By k_min ≈ 6 the two agree closely, which is Clauset et al.'s rule of thumb.");
}
