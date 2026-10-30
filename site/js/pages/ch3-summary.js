import "../layout.js";
import { h, figure, select, dataTable } from "../lib/ui.js";
import { fmt, poissonKmax, giantComponentFraction } from "../lib/stats.js";
import { loadNetworks, NETWORK_ORDER, SHORT } from "../lib/data.js";

const EULER = 0.5772156649;

/** Properties compared on this page: value in the data, in the simulated G(N, L), and in random-network theory. */
const PROPS = [
  { key: "k2", label: "⟨k²⟩", real: (d) => d.k2, sim: (d) => d.nullModels.er.k2, theory: (d) => d.avgk * (1 + d.avgk), f: (v) => fmt.sig(v, 4) },
  { key: "kmax", label: "largest degree k_max", real: (d) => d.kmax, sim: (d) => d.nullModels.er.kmax, theory: (d) => poissonKmax(d.N, d.avgk), f: fmt.int },
  { key: "giant", label: "giant component N_G/N", real: (d) => d.components.giantFraction, sim: (d) => d.nullModels.er.giant, theory: (d) => giantComponentFraction(d.avgk), f: (v) => fmt.pct(v, 2) },
  { key: "d", label: "average distance ⟨d⟩", real: (d) => d.distances.avg, sim: (d) => d.nullModels.er.avgd, theory: (d) => (Math.log(d.N) - EULER) / Math.log(d.avgk) + 0.5, f: (v) => fmt.fix(v, 2) },
  { key: "C", label: "average clustering ⟨C⟩", real: (d) => d.clustering.avg, sim: (d) => d.nullModels.er.C, theory: (d) => d.avgk / d.N, f: (v) => fmt.sig(v, 3) },
  { key: "r", label: "degree assortativity r", real: (d) => d.assortativity, sim: (d) => d.nullModels.er.r, theory: () => 0, f: (v) => fmt.fix(v, 3), diff: true },
];

const ICON_OK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8.5l3 3L13 4.5"/></svg>';
const ICON_NO = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
const ICON_MEH = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3.5 8h9"/></svg>';

/** How well the random network does: a ratio within ±20% is "right", within a factor 2 "roughly", else "wrong". */
function judge(p, real, rnd) {
  if (p.diff) {
    const dd = Math.abs(real - rnd);
    return dd < 0.05 ? ["ok", "right"] : dd < 0.15 ? ["meh", `off by ${dd.toFixed(2)}`] : ["no", `off by ${dd.toFixed(2)}`];
  }
  if (p.key === "giant") {
    const out = 1 - real, outR = 1 - rnd;
    const close = Math.abs(real - rnd) < 0.02;
    return close ? ["ok", "right"] : ["meh", `exists, but ${fmt.pct(out, 1)} outside vs ${fmt.pct(outR, 2)}`];
  }
  const r = real / rnd;
  if (r > 0.8 && r < 1.25) return ["ok", "right"];
  if (r > 0.5 && r < 2) return ["meh", `roughly (${r.toFixed(2)}×)`];
  return ["no", r >= 1 ? `${fmt.sig(r, 2)}× too small` : `${fmt.sig(1 / r, 2)}× too large`];
}
const verdictEl = ([cls, text]) => h("span", { class: "verdict " + cls, html: (cls === "ok" ? ICON_OK : cls === "no" ? ICON_NO : ICON_MEH) + `<span>${text}</span>` });

(async () => {
  const { networks } = await loadNetworks();
  let name = "collaboration";

  // ---------------------------------------------------------------- 1. scorecard for one network
  const f = figure("#fig-score", { title: "Scorecard: the random network model against one real network", sub: "The random counterpart has the same N and L. ‘Theory’ is the random-network formula, ‘simulated’ a G(N, L) built from the data's N and L." });
  const host = h("div");
  f.body.append(host);
  function draw() {
    const d = networks[name];
    const rows = PROPS.map((p) => [p.label, p.f(p.real(d)), p.f(p.theory(d)), p.f(p.sim(d)), verdictEl(judge(p, p.real(d), p.sim(d)))]);
    host.replaceChildren(dataTable([
      { label: "Property", align: "left" }, { label: `${d.description} (data)` }, { label: "random theory" }, { label: "G(N, L) simulated" }, { label: "random model gets it…", align: "left" },
    ], rows));
  }
  select(f.controls, { label: "Network", value: name, options: NETWORK_ORDER.map((n) => ({ value: n, label: networks[n].description })), onChange: (v) => { name = v; draw(); } });
  draw();
  f.setCaption("Theory: ⟨k²⟩ = ⟨k⟩(1 + ⟨k⟩), k_max from N·P(K > k_max) = 1, S = 1 − exp(−⟨k⟩S), ⟨d⟩ ≈ (ln N − γ_E)/ln⟨k⟩ + ½ (Fronczak et al. 2004; not in the book), C = ⟨k⟩/N and r = 0. The verdict compares the data with the simulated counterpart: within 25% is “right”, within a factor of two “roughly”.");

  // ---------------------------------------------------------------- 2. all networks at once
  const g = figure("#fig-heat", { title: "How far off is the random network, for every network?", sub: "Ratio of the real value to that of its random counterpart G(N, L). Orange: the data are larger; blue: smaller; grey: within 25%." });
  const keys = ["k2", "kmax", "d", "C"];
  const cell = (r) => {
    const l = Math.log10(r);
    const a = Math.min(1, Math.abs(l) / 3);
    const neutral = Math.abs(l) < Math.log10(1.25);
    const bg = neutral ? "var(--surface-2)" : `color-mix(in srgb, var(--${l > 0 ? "s2" : "s1"}) ${Math.round(12 + 48 * a)}%, var(--surface))`;
    const txt = r >= 10 ? `${fmt.int(r)}×` : `${r.toFixed(2)}×`;
    return h("td", { style: { background: bg, fontWeight: 600, textAlign: "center" } }, txt);
  };
  const thead = h("thead", {}, h("tr", {}, h("th", { class: "left" }, "Network"), ...keys.map((k) => h("th", { style: { textAlign: "center" } }, PROPS.find((p) => p.key === k).label)), h("th", { style: { textAlign: "center" } }, "outside the giant comp., real / random")));
  const tbody = h("tbody", {}, NETWORK_ORDER.map((n) => {
    const d = networks[n];
    const outReal = 1 - d.components.giantFraction, outSim = 1 - d.nullModels.er.giant;
    return h("tr", {}, h("td", { class: "left" }, d.description), ...keys.map((k) => { const p = PROPS.find((q) => q.key === k); return cell(p.real(d) / p.sim(d)); }),
      h("td", { style: { textAlign: "center" } }, `${fmt.pct(outReal, 2)} / ${fmt.pct(outSim, 2)}`));
  }));
  g.body.append(h("div", { class: "table-scroll" }, h("table", { class: "data" }, thead, tbody)));
  g.setCaption("The random model underestimates k_max (it has no hubs) and ⟨C⟩ (it has no triangles) for every network, by up to four orders of magnitude, and ⟨k²⟩ for every network but the power grid. Distances are the one property it gets roughly right for most networks; the power grid and the networks with the biggest hubs are the exceptions. Colour intensity grows with the logarithm of the ratio and saturates at 1,000×; the number in each cell is the ratio itself.");
})();
