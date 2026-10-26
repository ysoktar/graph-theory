import "../layout.js";
import { h, figure, select, button, stats, dataTable } from "../lib/ui.js";
import { NetView } from "../lib/netview.js";
import { Plot } from "../lib/plot.js";
import { RNG } from "../lib/rng.js";
import { labelPropagation, louvain, modularity, CSRGraph, gnmPairs } from "../lib/graph.js";
import { symmetricEigen, normalizedLaplacian } from "../lib/linalg.js";
import { fmt } from "../lib/stats.js";
import { karateGraph, loadNetworks, loadRealGraph, WITH_EDGES } from "../lib/data.js";

const PALETTE = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];
const colorOf = (l) => (l < PALETTE.length ? PALETTE[l] : "random");

// ------------------------------------------------------------------ 1. the karate club
(async () => {
  const { graph: K, club } = await karateGraph();
  const observed = Int32Array.from(club, (c) => (c === "Mr. Hi" ? 0 : 1));
  let labels = Int32Array.from(observed), seed = 1, what = "observed";
  const f = figure("#fig-karate", { title: "Finding the karate club's factions", sub: "Click a member to move it to the other group (or to the next group). Modularity updates live.", cols: "split" });
  const pn = f.panel(null), pr = f.panel(null);
  const nv = new NetView(pn, {
    height: 400, charge: -90, linkDistance: 38,
    nodeRadius: (v) => 5 + 0.9 * K.degree(v), nodeColor: (v) => colorOf(labels[v]),
    nodeRing: (v) => (labels[v] !== observed[v] && what !== "observed" && new Set(labels).size === 2 ? "text" : null),
    edgeColor: (u, v) => (labels[u] === labels[v] ? "axis" : "s8"), edgeWidth: (u, v) => (labels[u] === labels[v] ? 1 : 1.6),
    tooltip: (v) => `member ${v}: group ${labels[v] + 1}, joined ${club[v]}`,
    onClick: (v) => { labels[v] = (labels[v] + 1) % Math.max(2, new Set(labels).size); what = "manual"; paint(); },
  });
  nv.setGraph(K);
  const t = stats(pr, [{ key: "Q", label: "modularity Q" }, { key: "c", label: "groups" }, { key: "cut", label: "links between groups" }, { key: "agree", label: "agreement with the real split" }]);
  const note = h("p", { class: "small muted" });
  pr.append(note);
  function paint() {
    let cut = 0;
    for (const [u, v] of K.edges()) if (labels[u] !== labels[v]) cut++;
    const groups = new Set(labels).size;
    let agree = 0;
    for (let v = 0; v < K.n; v++) if (labels[v] === observed[v]) agree++;
    t.set("Q", fmt.fix(modularity(K, labels), 4)); t.set("c", groups); t.set("cut", `${cut} of ${K.m}`, "red links");
    t.set("agree", groups === 2 ? `${Math.max(agree, K.n - agree)} of ${K.n}` : "–", groups === 2 ? "members on the right side" : "only defined for two groups");
    note.textContent = { observed: "The split the club actually underwent (Zachary 1977).", manual: "Your partition.", lpa: "Label propagation: every node repeatedly adopts the most common label among its neighbours.", louvain: "Louvain: greedy modularity optimisation with node moves and aggregation.", spectral: "Spectral bisection: the sign of the Fiedler vector of the normalised Laplacian." }[what];
    nv.redraw();
  }
  const row = h("div", { class: "btn-row" });
  f.controls.append(row);
  button(row, { label: "Real split", onClick: () => { labels = Int32Array.from(observed); what = "observed"; paint(); } });
  button(row, { label: "Spectral bisection", onClick: () => { const { vectors } = symmetricEigen(normalizedLaplacian(K), K.n); const s0 = Math.sign(vectors[1][0]); labels = Int32Array.from(vectors[1], (x) => (Math.sign(x) === s0 ? 0 : 1)); what = "spectral"; paint(); } });
  button(row, { label: "Label propagation", icon: "dice", onClick: () => { labels = labelPropagation(K, new RNG(seed++)); what = "lpa"; paint(); } });
  button(row, { label: "Louvain", icon: "dice", onClick: () => { labels = louvain(K, new RNG(seed++)); what = "louvain"; paint(); } });
  paint();
  f.setCaption("The real split has Q = 0.358. Louvain finds four groups with Q ≈ 0.42, the highest modularity any partition of this network reaches: the partition that maximises Q is not the one the club chose. Label propagation is fast but gives a different answer on every run.");
})();

// ------------------------------------------------------------------ 2. real networks, and the random-network trap
(async () => {
  const { networks } = await loadNetworks();
  let name = "collaboration";
  const f = figure("#fig-real", { title: "Communities in a real network and in its random counterpart", sub: "Louvain on the real network and on G(N, L) with the same N and L. A random network has no communities, yet its modularity is far from zero." });
  const status = h("div", { class: "status-line" });
  const host = h("div");
  f.body.append(host);
  const plot = new Plot(f.body, { height: 260, x: { type: "log", label: "community size (nodes)" }, y: { type: "log", label: "number of communities" } });
  async function go() {
    const d = networks[name];
    status.textContent = `Running Louvain on ${d.description}…`;
    await new Promise((r) => setTimeout(r, 20));
    const g = await loadRealGraph(name);
    const lr = louvain(g, new RNG(1));
    const er = CSRGraph.fromPairs(d.N, gnmPairs(d.N, d.L, new RNG(2)));
    const le = louvain(er, new RNG(1));
    const sizes = (lab) => { const c = new Map(); for (const l of lab) c.set(l, (c.get(l) || 0) + 1); const s = new Map(); for (const v of c.values()) s.set(v, (s.get(v) || 0) + 1); return { n: c.size, hist: [...s.entries()].sort((a, b) => a[0] - b[0]), max: Math.max(...c.values()) }; };
    const sr = sizes(lr), se = sizes(le);
    status.textContent = "";
    host.replaceChildren(dataTable([{ label: "", align: "left" }, { label: "modularity Q" }, { label: "communities" }, { label: "largest community" }],
      [[`${d.description} (real)`, modularity(g, lr).toFixed(3), fmt.int(sr.n), fmt.int(sr.max)], ["G(N, L), same N and L", modularity(er, le).toFixed(3), fmt.int(se.n), fmt.int(se.max)]]));
    plot.update({ series: [{ type: "scatter", data: sr.hist, color: 1, label: "real network", r: 3.5 }, { type: "scatter", data: se.hist, color: "random", symbol: "square", label: "G(N, L)", r: 3.5 }], xName: "size", yFormat: fmt.int });
  }
  select(f.controls, { label: "Network", value: name, options: WITH_EDGES.map((n) => ({ value: n, label: networks[n].description })), onChange: (v) => { name = v; go(); } });
  f.controls.append(status);
  go();
  f.setCaption("Sparse random networks reach surprisingly high modularity because there are so many ways to cut them into pieces (Guimerà, Sales-Pardo and Amaral 2004). A high Q on its own is therefore no proof of community structure: compare it with the Q of a random network of the same size and density. Many of the small real communities are simply the network's small components, which no algorithm can join to anything.");
})();
