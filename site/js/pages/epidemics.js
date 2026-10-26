import "../layout.js";
import { h, figure, slider, select, button, stats, ICONS } from "../lib/ui.js";
import { NetView } from "../lib/netview.js";
import { Plot } from "../lib/plot.js";
import { RNG } from "../lib/rng.js";
import { gnp, gnmPairs, powerlawSequence, configurationModel, pairsToGraph, giantComponent, CSRGraph } from "../lib/graph.js";
import { fmt } from "../lib/stats.js";
import { loadNetworks, loadRealGraph, WITH_EDGES } from "../lib/data.js";
import { run } from "../lib/compute.js";

/** Bond-percolation threshold of SIR with per-link transmissibility T: T_c = ⟨k⟩ / (⟨k²⟩ − ⟨k⟩). */
const threshold = (deg) => { let s = 0, s2 = 0; for (const k of deg) { s += k; s2 += k * k; } return s / (s2 - s); };
const toPairs = (g) => { const e = g.edges(), p = new Int32Array(2 * e.length); e.forEach(([u, v], i) => { p[2 * i] = u; p[2 * i + 1] = v; }); return p; };

// ------------------------------------------------------------------ 1. watch an outbreak
{
  const N = 300;
  let beta = 0.25, seed = 1, timer = null;
  const f = figure("#fig-outbreak", { title: "An outbreak, step by step", sub: "SIR in discrete time: every newly infected node infects each susceptible neighbour with probability T, then recovers. Same T on both networks.", cols: "cols-2" });
  const mk = (title) => {
    const p = f.panel(title), st = { state: null, g: null, frontier: [], title: p.querySelector(".panel-title") };
    st.view = new NetView(p, { height: 300, toolbar: false, charge: -14, linkDistance: 14, gravity: 0.12, nodeRadius: (i) => 1.8 + Math.sqrt(st.g.degree(i)), nodeColor: (i) => ["random", "s8", "s1"][st.state[i]], edgeColor: () => "axis", legend: [{ label: "susceptible", color: "random" }, { label: "infected", color: "s8" }, { label: "recovered", color: "s1" }] });
    return st;
  };
  const A = mk(""), B = mk("");
  const t = stats(f.body, [{ key: "a", label: "random network: ever infected" }, { key: "b", label: "scale-free network: ever infected" }]);
  t.el.style.gridColumn = "1 / -1";
  function build() {
    const rng = new RNG(seed);
    const sf = giantComponent(pairsToGraph(N, configurationModel(powerlawSequence(N, 2.3, 1, rng), rng).pairs)).graph;
    const er = giantComponent(gnp(N, (2 * sf.m) / sf.n / (N - 1), rng)).graph;
    A.g = er; B.g = sf;
    A.title.textContent = `Random network (T_c = ${threshold(er.degrees()).toFixed(2)})`;
    B.title.textContent = `Scale-free, γ = 2.3 (T_c = ${threshold(sf.degrees()).toFixed(2)})`;
    for (const s of [A, B]) s.view.setGraph(s.g, { keep: false });
    reset();
  }
  function reset() {
    for (const s of [A, B]) {
      s.state = new Uint8Array(s.g.n);
      // start at a node of median degree, so the comparison is not decided by the first node
      const d = s.g.degrees(), order = [...d.keys()].sort((a, b) => d[a] - d[b]);
      const s0 = order[Math.floor(order.length / 2)];
      s.state[s0] = 1; s.frontier = [s0]; s.rng = new RNG(seed * 7);
    }
    paint();
  }
  function step() {
    let any = false;
    for (const s of [A, B]) {
      const next = [];
      for (const u of s.frontier) { for (const v of s.g.neighbors(u)) if (s.state[v] === 0 && s.rng.random() < beta) { s.state[v] = 1; next.push(v); } s.state[u] = 2; }
      s.frontier = next; if (next.length) any = true;
    }
    paint();
    if (!any) stop();
  }
  function paint() {
    for (const [s, key] of [[A, "a"], [B, "b"]]) { let ever = 0; for (const x of s.state) if (x) ever++; t.set(key, fmt.pct(ever / s.g.n, 0), `${ever} of ${s.g.n} nodes`); s.view.redraw(); }
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; playBtn.innerHTML = ICONS.play + " Run"; } }
  slider(f.controls, { label: "transmissibility T", min: 0.02, max: 0.8, step: 0.01, value: beta, format: (v) => v.toFixed(2), onInput: (v) => { beta = v; } });
  const row = h("div", { class: "btn-row" });
  f.controls.append(row);
  const playBtn = button(row, { label: "Run", icon: "play", onClick: () => { if (timer) stop(); else { timer = setInterval(step, 350); playBtn.innerHTML = ICONS.pause + " Pause"; } } });
  button(row, { label: "Restart", icon: "reset", onClick: () => { stop(); reset(); } });
  button(row, { label: "New networks", icon: "dice", onClick: () => { stop(); seed++; build(); } });
  build();
  f.setCaption("At T = 0.25 the outbreak usually dies out in the random network but reaches the hubs of the scale-free network and spreads through it. Run it a few times: single outbreaks are random.");
}

// ------------------------------------------------------------------ 2. outbreak size versus T, and vaccination (worker)
(async () => {
  const { networks } = await loadNetworks();
  let name = "synthetic", cover = 0.1, job = null;
  const f = figure("#fig-vacc", { title: "Outbreak size and vaccination strategies", sub: "Average share of nodes ever infected, from a random starting node, 20 outbreaks per point (background thread)." });
  const t = stats(f.body, [{ key: "tc", label: "threshold T_c = ⟨k⟩/(⟨k²⟩ − ⟨k⟩)" }, { key: "er", label: "same-density random network" }]);
  const status = h("div", { class: "status-line" });
  const plot = new Plot(f.body, { height: 320, x: { label: "transmissibility T", min: 0, max: 0.5 }, y: { label: "share ever infected", min: 0 } });
  async function go() {
    if (job) job.cancel();
    status.textContent = "Preparing…";
    const rng = new RNG(4);
    let g;
    if (name === "synthetic") { const N = 5000; g = CSRGraph.fromPairs(N, configurationModel(powerlawSequence(N, 2.3, 2, rng), rng).pairs); }
    else g = await loadRealGraph(name);
    const n = g.n, deg = g.degrees(), nv = Math.round(cover * n);
    const hubs = [...deg.keys()].sort((a, b) => deg[b] - deg[a]).slice(0, nv);
    const randomSet = rng.sample(n, nv);
    const acq = new Set();
    for (let tries = 0; acq.size < nv && tries < 50 * n; tries++) { const v = rng.int(n); const nb = g.neighbors(v); if (nb.length) acq.add(nb[rng.int(nb.length)]); }
    const pairs = toPairs(g);
    const er = CSRGraph.fromPairs(n, gnmPairs(n, g.m, rng));
    t.set("tc", fmt.fix(threshold(deg), 3), name === "synthetic" ? "configuration model, γ = 2.3, N = 5,000" : networks[name].description);
    t.set("er", fmt.fix(threshold(er.degrees()), 3), "≈ 1/⟨k⟩");
    const betas = [];
    for (let b = 0.01; b <= 0.5001; b += 0.02) betas.push(+b.toFixed(2));
    const graphs = [
      { label: "no vaccination", n, pairs },
      { label: `random vaccination (${fmt.pct(cover, 0)})`, n, pairs, immune: randomSet },
      { label: `acquaintance vaccination (${fmt.pct(cover, 0)})`, n, pairs, immune: [...acq] },
      { label: `vaccinate the hubs (${fmt.pct(cover, 0)})`, n, pairs, immune: hubs },
      { label: "random network, same density", n, pairs: toPairs(er) },
    ];
    status.textContent = "Simulating…";
    const out = {};
    job = run("sirSweep", { graphs, betas, reps: 20, seed: 5 }, (p) => { status.textContent = `${p.label} done`; });
    let res;
    try { res = await job.promise; } catch { return; }
    job = null;
    status.textContent = "";
    Object.assign(out, res);
    plot.update({
      series: graphs.map((gd, i) => ({ type: "line", markers: true, r: 2.5, data: out[gd.label], color: i === 4 ? "random" : i + 1, dashed: i === 4, label: gd.label })),
      rules: [{ x: threshold(deg), label: "T_c", color: "theory", dashed: true }], xName: "T", yFormat: (v) => fmt.pct(v, 1),
    });
  }
  select(f.controls, { label: "Network", value: name, options: [{ value: "synthetic", label: "Scale-free model (N = 5,000, γ = 2.3)" }, ...WITH_EDGES.map((n) => ({ value: n, label: networks[n].description }))], onChange: (v) => { name = v; go(); } });
  slider(f.controls, { label: "vaccination coverage", min: 0.01, max: 0.3, step: 0.01, value: cover, format: (v) => fmt.pct(v, 0), onChange: (v) => { cover = v; go(); } });
  f.controls.append(status);
  go();
  f.setCaption("Above its tiny threshold the scale-free network's outbreaks start small and grow slowly with T, unlike the random network's sharp take-off near 1/⟨k⟩. Vaccinating random people barely helps a heavy-tailed network. Vaccinating the hubs raises the threshold dramatically, but requires knowing the whole network. Acquaintance vaccination (Cohen, Havlin and ben-Avraham 2003) needs no such knowledge: ask random people to name a contact, and vaccinate the contact. Contacts are more likely to be hubs (the friendship paradox), so it gets much of the benefit of targeting hubs.");
})();
