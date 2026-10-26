import "../layout.js";
import { h, figure, slider, button, stats, color, ICONS } from "../lib/ui.js";
import { NetView, layouts } from "../lib/netview.js";
import { Plot } from "../lib/plot.js";
import { RNG } from "../lib/rng.js";
import { gnp, gnpPairs } from "../lib/graph.js";
import { binomPmf, fmt, mean, std, arrMin, arrMax } from "../lib/stats.js";

// ------------------------------------------------------------------ 1. build G(N, p) pair by pair
{
  let N = 14, p = 0.2, pairs = [], idx = 0, edges = [], last = null, timer = null;
  const rng = new RNG(1);
  const f = figure("#fig-build", { title: "G(N, p), one coin flip per pair", sub: "Every pair of nodes is examined once; a link appears with probability p.", cols: "split" });
  const pn = f.panel(null), pr = f.panel(null);
  const nv = new NetView(pn, {
    height: 380, toolbar: false, zoom: false, drag: false,
    nodeRadius: () => 9, nodeColor: (i) => (last && (i === last.u || i === last.v) ? "s2" : "s1"),
    edgeColor: () => "text-2", edgeWidth: () => 1.8,
    afterNodes: (ctx, api) => {
      if (!last || last.added) return;
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = color("s2");
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(api.sx[last.u], api.sy[last.u]); ctx.lineTo(api.sx[last.v], api.sy[last.v]); ctx.stroke();
      ctx.restore();
    },
  });
  const t = stats(pr, [{ key: "pairs", label: "pairs examined" }, { key: "L", label: "links so far" }, { key: "exp", label: "expected so far, p × pairs" }]);
  const msg = h("p", { class: "small", style: { minHeight: "3em", marginTop: "10px" }, "aria-live": "polite" });
  pr.append(msg);
  function reset() {
    stop();
    pairs = [];
    for (let u = 0; u < N; u++) for (let v = u + 1; v < N; v++) pairs.push([u, v]);
    idx = 0; edges = []; last = null;
    nv.setGraph({ n: N, edges: [] }, { positions: layouts.circle(N, 150) });
    render();
  }
  function step() {
    if (idx >= pairs.length) { stop(); return false; }
    const [u, v] = pairs[idx++];
    const roll = rng.random();
    const added = roll < p;
    if (added) edges.push([u, v]);
    last = { u, v, roll, added };
    return true;
  }
  function render() {
    nv.setGraph({ n: N, edges }, { positions: layouts.circle(N, 150) });
    const M = pairs.length;
    t.set("pairs", `${idx} / ${M}`); t.set("L", edges.length); t.set("exp", fmt.fix(p * idx, 1));
    msg.textContent = last ? `Pair (${last.u}, ${last.v}): random number ${last.roll.toFixed(3)} ${last.added ? "<" : "≥"} p = ${p} → ${last.added ? "link added" : "no link"}.` : `Examine the ${M} pairs one at a time.`;
    if (idx >= M) msg.textContent += ` Done: L = ${edges.length}, against ⟨L⟩ = p·N(N−1)/2 = ${fmt.fix(p * M, 1)}.`;
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; playBtn.innerHTML = ICONS.play + " Play"; } }
  slider(f.controls, { label: "nodes N", min: 4, max: 30, step: 1, value: N, onInput: (v) => { N = v; reset(); } });
  slider(f.controls, { label: "probability p", min: 0, max: 1, step: 0.01, value: p, format: (v) => v.toFixed(2), onInput: (v) => { p = v; reset(); } });
  const row = h("div", { class: "btn-row" });
  f.controls.append(row);
  button(row, { label: "Step", icon: "step", onClick: () => { stop(); step(); render(); } });
  const playBtn = button(row, { label: "Play", icon: "play", onClick: () => { if (timer) stop(); else { timer = setInterval(() => { if (!step()) stop(); render(); }, 90); playBtn.innerHTML = ICONS.pause + " Pause"; } } });
  button(row, { label: "Finish", onClick: () => { stop(); while (step()); render(); } });
  button(row, { label: "Reset", icon: "reset", onClick: reset });
  reset();
}

// ------------------------------------------------------------------ 2. three realisations
{
  const N = 12, p = 1 / 6;
  let seed = 3;
  const f = figure("#fig-three", { title: "Three realisations of G(N = 12, p = 1/6)", sub: "Same model, different networks.", cols: "cols-3" });
  const views = [0, 1, 2].map((i) => {
    const panel = f.panel("");
    const nv = new NetView(panel, { height: 220, toolbar: false, zoom: false, nodeRadius: () => 7, nodeColor: () => "random", edgeColor: () => "text-2", edgeWidth: () => 1.6 });
    return { panel, nv };
  });
  function draw() {
    const rng = new RNG(seed);
    views.forEach(({ panel, nv }, i) => {
      const g = gnp(N, p, rng);
      nv.setGraph(g, { positions: layouts.circle(N, 100) });
      panel.querySelector(".panel-title").textContent = `realisation ${i + 1}: L = ${g.m}, ⟨k⟩ = ${fmt.fix((2 * g.m) / N, 2)}`;
    });
  }
  button(f.controls, { label: "Three new realisations", icon: "dice", onClick: () => { seed++; draw(); } });
  draw();
  f.setCaption(`Expected number of links: p·N(N−1)/2 = 66/6 = 11, with standard deviation √(66·p(1−p)) ≈ 3.0.`);
}

// ------------------------------------------------------------------ 3. distribution of L
{
  let N = 200, p = 0.05, R = 1000, seed = 2026;
  const f = figure("#fig-ldist", { title: "The number of links over many realisations", sub: "Each realisation is a full G(N, p) network generated in your browser." });
  const t = stats(f.body, [
    { key: "mt", label: "⟨L⟩ theory: p·N(N−1)/2" }, { key: "ms", label: "⟨L⟩ simulated" },
    { key: "st", label: "σ_L theory: √(L_max p(1−p))" }, { key: "ss", label: "σ_L simulated" },
  ]);
  const plot = new Plot(f.body, { height: 280, x: { label: "number of links L" }, y: { label: "probability" } });
  function run() {
    const rng = new RNG(seed);
    const Ls = [];
    for (let r = 0; r < R; r++) Ls.push(gnpPairs(N, p, rng).length / 2);
    const Lmax = (N * (N - 1)) / 2;
    const mu = p * Lmax, sd = Math.sqrt(Lmax * p * (1 - p));
    t.set("mt", fmt.fix(mu, 1)); t.set("ms", fmt.fix(mean(Ls), 1)); t.set("st", fmt.fix(sd, 1)); t.set("ss", fmt.fix(std(Ls), 1));
    // histogram with bins of width w, density-normalised
    const lo = arrMin(Ls), hi = arrMax(Ls);
    const w = Math.max(1, Math.ceil((hi - lo + 1) / 30));
    const bins = new Map();
    for (const L of Ls) { const b = lo + Math.floor((L - lo) / w) * w; bins.set(b, (bins.get(b) || 0) + 1); }
    const hist = [...bins.entries()].sort((a, b) => a[0] - b[0]).map(([b, c]) => [b + (w - 1) / 2, c / (R * w)]);
    const th = [];
    for (let L = Math.max(0, Math.floor(mu - 4.5 * sd)); L <= Math.ceil(mu + 4.5 * sd); L++) th.push([L, binomPmf(L, Lmax, p)]);
    plot.update({
      series: [
        { type: "bar", data: hist, color: "random", label: `${R} realisations of G(N = ${N}, p = ${p})`, format: (v) => v.toExponential(2) },
        { type: "line", data: th, color: "theory", dashed: true, label: "binomial theory", format: (v) => v.toExponential(2) },
      ],
      xName: "L", y: { min: 0 },
    });
  }
  slider(f.controls, { label: "nodes N", min: 20, max: 800, step: 10, value: N, onChange: (v) => { N = v; run(); } });
  slider(f.controls, { label: "probability p", min: 0.002, max: 0.3, step: 0.001, value: p, log: true, format: (v) => v.toFixed(3), onChange: (v) => { p = v; run(); } });
  slider(f.controls, { label: "realisations", min: 100, max: 3000, step: 100, value: R, onChange: (v) => { R = v; run(); } });
  button(f.controls, { label: "New seed", icon: "dice", onClick: () => { seed++; run(); } });
  run();
  f.setCaption("The sliders update on release, because each update generates up to 3,000 networks. The defaults are the notebook's (N = 200, p = 0.05, 1,000 realisations), for which it reports ⟨L⟩ = 995.0 against 996.1 and σ_L = 30.7 against 30.9. A different random seed gives slightly different simulated values.");
}
