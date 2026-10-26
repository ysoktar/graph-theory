import "../layout.js";
import { h, figure, segmented, button, dataTable } from "../lib/ui.js";
import { loadNetworks, NETWORK_ORDER } from "../lib/data.js";
import { fmt } from "../lib/stats.js";

const SVGNS = "http://www.w3.org/2000/svg";
const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const c of kids) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
};

// Land masses: B north bank, C south bank, A the Kneiphof island, D the land between the two branches.
const LANDS = ["A", "B", "C", "D"];
const BRIDGES = [
  { id: "a", u: "A", v: "B", x: 215, y1: 120, y2: 158 },
  { id: "b", u: "A", v: "B", x: 305, y1: 120, y2: 158 },
  { id: "c", u: "A", v: "C", x: 215, y1: 222, y2: 260 },
  { id: "d", u: "A", v: "C", x: 305, y1: 222, y2: 260 },
  { id: "e", u: "A", v: "D", horizontal: true, y: 190, x1: 358, x2: 422 },
  { id: "f", u: "B", v: "D", x: 545, y1: 120, y2: 160 },
  { id: "g", u: "C", v: "D", x: 545, y1: 220, y2: 260 },
  { id: "h", u: "B", v: "C", x: 70, y1: 120, y2: 260, extra: true },
  { id: "i", u: "A", v: "D", horizontal: true, y: 172, x1: 352, x2: 422, extra: true },
].map((b) => ({ ...b, present: !b.extra }));

const state = { mode: "walk", start: null, current: null, used: [], lands: [], message: "", animating: null };

const f = figure("#fig-walk", { title: "The seven bridges of Königsberg", cols: "split" });
const mapPanel = f.panel("The city (stylised)"), graphPanel = f.panel("The graph");
const status = h("div", { class: "status-line", style: { fontSize: ".95rem", margin: "6px 0" }, "aria-live": "polite" });
const walkLine = h("div", { class: "small", style: { color: "var(--text-2)", minHeight: "1.5em" } });
const degreeBox = h("div");
f.body.after(h("div", { style: { marginTop: "10px" } }, status, walkLine, degreeBox));

segmented(f.controls, {
  label: "Mode", value: "walk",
  options: [{ value: "walk", label: "Take the walk" }, { value: "edit", label: "Edit bridges" }],
  onChange: (v) => { state.mode = v; resetWalk(); render(); },
});
const btns = h("div", { class: "btn-row" });
f.controls.append(btns);
button(btns, { label: "Restart walk", icon: "reset", onClick: () => { resetWalk(); render(); } });
const solveBtn = button(btns, { label: "Show a solution", icon: "play", onClick: () => animateSolution() });
button(btns, { label: "Original seven bridges", onClick: () => { BRIDGES.forEach((b) => { b.present = !b.extra; }); resetWalk(); render(); } });

// ---------------------------------------------------------------- map
const map = s("svg", { viewBox: "0 0 640 380", role: "img", "aria-label": "Stylised map of Königsberg with its bridges", style: "width:100%;height:auto;display:block;border-radius:10px;border:1px solid var(--border)" });
mapPanel.append(map);
const water = "color-mix(in srgb, var(--s1) 22%, var(--surface))";
const land = "var(--surface-2)";
map.append(
  s("rect", { x: 0, y: 0, width: 640, height: 380, fill: land }),
  s("rect", { x: 0, y: 120, width: 640, height: 140, fill: water }),
);
const landShapes = {
  B: s("rect", { x: 0, y: 0, width: 640, height: 120, fill: "transparent" }),
  C: s("rect", { x: 0, y: 260, width: 640, height: 120, fill: "transparent" }),
  A: s("ellipse", { cx: 260, cy: 190, rx: 100, ry: 38, fill: land }),
  D: s("rect", { x: 420, y: 158, width: 230, height: 64, rx: 28, fill: land }),
};
const landLabelPos = { A: [260, 197], B: [400, 70], C: [400, 325], D: [482, 197] };
for (const L of LANDS) {
  const g = s("g", { style: "cursor:pointer", tabindex: 0, role: "button", "aria-label": `land ${L}` });
  g.append(landShapes[L]);
  g.addEventListener("click", () => clickLand(L));
  g.addEventListener("keydown", (e) => { if (e.key === "Enter") clickLand(L); });
  map.append(g);
}
map.append(s("text", { x: 20, y: 200, "font-size": 13, fill: "var(--text-2)", "font-style": "italic" }, "Pregel"));
const landLabels = {};
for (const L of LANDS) {
  const [x, y] = landLabelPos[L];
  landLabels[L] = s("text", { x, y, "text-anchor": "middle", "font-size": 22, "font-weight": 700, "pointer-events": "none" }, L);
  map.append(landLabels[L]);
}
const bridgeEls = {};
for (const b of BRIDGES) {
  const g = s("g", { style: "cursor:pointer", tabindex: 0, role: "button", "aria-label": `bridge ${b.id} between ${b.u} and ${b.v}` });
  const r = b.horizontal
    ? s("rect", { x: b.x1, y: b.y - 7, width: b.x2 - b.x1, height: 14, rx: 4 })
    : s("rect", { x: b.x - 8, y: b.y1, width: 16, height: b.y2 - b.y1, rx: 4 });
  const lx = b.horizontal ? (b.x1 + b.x2) / 2 : b.x + 15;
  const ly = b.horizontal ? b.y - 11 : (b.y1 + b.y2) / 2 + 4;
  const t = s("text", { x: lx, y: ly, "font-size": 13, "font-weight": 650, "text-anchor": b.horizontal ? "middle" : "start", "pointer-events": "none" }, b.id);
  g.append(r, t);
  g.addEventListener("click", () => clickBridge(b));
  g.addEventListener("keydown", (e) => { if (e.key === "Enter") clickBridge(b); });
  map.append(g);
  bridgeEls[b.id] = { g, r, t };
}

// ---------------------------------------------------------------- graph
const graph = s("svg", { viewBox: "0 0 360 380", role: "img", "aria-label": "The Königsberg multigraph", style: "width:100%;height:auto;display:block;border-radius:10px;border:1px solid var(--border);background:var(--surface)" });
graphPanel.append(graph);
const NODE = { B: [180, 52], A: [70, 190], C: [180, 328], D: [295, 190] };
const edgeLayer = s("g"), nodeLayer = s("g");
graph.append(edgeLayer, nodeLayer);
const graphEdges = {};
function edgePath(b) {
  const twins = BRIDGES.filter((x) => (x.present || state.mode === "edit") && sameEnds(x, b));
  const idx = twins.indexOf(b), n = twins.length;
  const [x1, y1] = NODE[b.u], [x2, y2] = NODE[b.v];
  const off = n > 1 ? (idx - (n - 1) / 2) * 56 : 0;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
  const cx = mx - (dy / L) * off, cy = my + (dx / L) * off;
  // the midpoint of a quadratic Bézier is halfway between the chord midpoint and the control point
  return { d: `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`, lx: (mx + cx) / 2, ly: (my + cy) / 2 };
}
const sameEnds = (x, b) => (x.u === b.u && x.v === b.v) || (x.u === b.v && x.v === b.u);
for (const b of BRIDGES) {
  const g = s("g", { style: "cursor:pointer" });
  const hit = s("path", { fill: "none", stroke: "transparent", "stroke-width": 16 });
  const vis = s("path", { fill: "none", "stroke-width": 3, "stroke-linecap": "round" });
  const lab = s("text", { "font-size": 13, "font-weight": 650, "text-anchor": "middle", "pointer-events": "none", "paint-order": "stroke", stroke: "var(--surface)", "stroke-width": 5, "stroke-linejoin": "round" }, b.id);
  g.append(vis, hit, lab);
  g.addEventListener("click", () => clickBridge(b));
  edgeLayer.append(g);
  graphEdges[b.id] = { g, hit, vis, lab };
}
const graphNodes = {};
for (const L of LANDS) {
  const [x, y] = NODE[L];
  const g = s("g", { style: "cursor:pointer" });
  const c = s("circle", { cx: x, cy: y, r: 22, "stroke-width": 3 });
  const t = s("text", { x, y: y + 7, "text-anchor": "middle", "font-size": 19, "font-weight": 700, fill: "#fff", "pointer-events": "none" }, L);
  const kx = L === "B" || L === "C" ? x + 52 : x, ky = L === "B" || L === "C" ? y + 5 : y - 32;
  const k = s("text", { x: kx, y: ky, "text-anchor": "middle", "font-size": 13, fill: "var(--text-2)", "pointer-events": "none" });
  g.append(c, t, k);
  g.addEventListener("click", () => clickLand(L));
  nodeLayer.append(g);
  graphNodes[L] = { c, k };
}

// ---------------------------------------------------------------- logic
const present = () => BRIDGES.filter((b) => b.present);
const degree = (L) => present().filter((b) => b.u === L || b.v === L).length;
function resetWalk() {
  if (state.animating) { clearInterval(state.animating); state.animating = null; }
  state.start = state.current = null; state.used = []; state.lands = []; state.message = "";
}
function clickLand(L) {
  if (state.mode !== "walk" || state.animating) return;
  if (!state.used.length) { state.start = state.current = L; state.lands = [L]; state.message = `You start on ${L}. Now click a bridge to cross it.`; }
  else state.message = "Finish (or restart) the current walk first.";
  render();
}
function clickBridge(b) {
  if (state.animating) return;
  if (state.mode === "edit") {
    b.present = !b.present;
    resetWalk();
    state.message = `${b.present ? "Added" : "Removed"} bridge ${b.id} (${b.u}–${b.v}).`;
    render();
    return;
  }
  if (!b.present) { state.message = "That bridge is not built. Switch to Edit bridges to add it."; render(); return; }
  if (!state.current) { state.message = "First click the land where you want to start."; render(); return; }
  if (state.used.includes(b.id)) { state.message = `You already crossed bridge ${b.id}.`; render(); return; }
  if (b.u !== state.current && b.v !== state.current) { state.message = `Bridge ${b.id} does not start on ${state.current}.`; render(); return; }
  state.used.push(b.id);
  state.current = b.u === state.current ? b.v : b.u;
  state.lands.push(state.current);
  const left = present().filter((x) => !state.used.includes(x.id));
  const options = left.filter((x) => x.u === state.current || x.v === state.current);
  if (!left.length) state.message = `Done: every bridge crossed exactly once, from ${state.start} to ${state.current}.`;
  else if (!options.length) state.message = `Stuck on ${state.current}: ${left.length} bridge${left.length > 1 ? "s" : ""} (${left.map((x) => x.id).join(", ")}) left, but none leaves ${state.current} unused.`;
  else state.message = `You are on ${state.current}. ${left.length} bridge${left.length > 1 ? "s" : ""} to go.`;
  render();
}

/** Hierholzer's algorithm on the multigraph; returns [{land, via}] or null. */
function eulerPath() {
  const E = present();
  const odd = LANDS.filter((L) => degree(L) % 2);
  if (odd.length !== 0 && odd.length !== 2) return null;
  const start = odd.length ? odd[0] : LANDS.find((L) => degree(L) > 0);
  if (!start) return null;
  const used = new Set();
  const stack = [{ land: start, via: null }], path = [];
  while (stack.length) {
    const top = stack[stack.length - 1];
    const e = E.find((b) => !used.has(b.id) && (b.u === top.land || b.v === top.land));
    if (e) { used.add(e.id); stack.push({ land: e.u === top.land ? e.v : e.u, via: e.id }); }
    else path.push(stack.pop());
  }
  path.reverse();
  return path.length - 1 === E.length ? path : null;
}

function animateSolution() {
  const path = eulerPath();
  if (!path) return;
  state.mode = "walk";
  resetWalk();
  state.start = state.current = path[0].land;
  state.lands = [path[0].land];
  let i = 1;
  state.message = `A solution starts on ${path[0].land}…`;
  render();
  state.animating = setInterval(() => {
    if (i >= path.length) { clearInterval(state.animating); state.animating = null; state.message = `Done: every bridge crossed exactly once, from ${path[0].land} to ${path[path.length - 1].land}.`; render(); return; }
    state.used.push(path[i].via);
    state.current = path[i].land;
    state.lands.push(path[i].land);
    i++;
    render();
  }, 650);
}

function render() {
  // map
  for (const b of BRIDGES) {
    const el = bridgeEls[b.id];
    const order = state.used.indexOf(b.id);
    el.g.style.display = b.present || state.mode === "edit" ? "" : "none";
    el.r.setAttribute("fill", !b.present ? "none" : order >= 0 ? "var(--s2)" : "var(--text-2)");
    el.r.setAttribute("stroke", !b.present ? "var(--text-2)" : "var(--surface)");
    el.r.setAttribute("stroke-dasharray", b.present ? "" : "4 3");
    el.r.setAttribute("stroke-width", b.present ? 1.5 : 1.5);
    el.t.textContent = order >= 0 ? `${b.id}·${order + 1}` : b.id;
    el.t.setAttribute("fill", "var(--text)");
  }
  for (const L of LANDS) {
    const on = state.current === L;
    landLabels[L].setAttribute("fill", on ? "var(--s2)" : "var(--text)");
    landLabels[L].textContent = on ? `● ${L}` : L;
  }
  // graph
  for (const b of BRIDGES) {
    const e = graphEdges[b.id];
    const show = b.present || state.mode === "edit";
    e.g.style.display = show ? "" : "none";
    if (!show) continue;
    const p = edgePath(b);
    e.vis.setAttribute("d", p.d); e.hit.setAttribute("d", p.d);
    const used = state.used.includes(b.id);
    e.vis.setAttribute("stroke", !b.present ? "var(--muted)" : used ? "var(--s2)" : "var(--text-2)");
    e.vis.setAttribute("stroke-dasharray", b.present ? "" : "5 4");
    e.vis.setAttribute("stroke-width", used ? 4 : 3);
    e.lab.setAttribute("x", p.lx); e.lab.setAttribute("y", p.ly + 4);
    e.lab.setAttribute("fill", "var(--text)");
  }
  const odd = LANDS.filter((L) => degree(L) % 2);
  for (const L of LANDS) {
    const k = degree(L);
    graphNodes[L].c.setAttribute("fill", state.current === L ? "var(--s2)" : "var(--s1)");
    graphNodes[L].c.setAttribute("stroke", k % 2 ? "var(--s8)" : "var(--surface)");
    graphNodes[L].k.textContent = `k = ${k}`;
  }
  // text
  status.textContent = state.message || (state.mode === "walk" ? "Click a piece of land to start." : "Click any bridge to build or remove it.");
  walkLine.textContent = state.start ? "Walk: " + state.lands.map((L, i) => (i ? ` —${state.used[i - 1]}→ ${L}` : L)).join("") : "";
  const verdict = odd.length === 0 ? "No land mass has an odd number of bridges: a closed walk crossing every bridge once exists, starting anywhere."
    : odd.length === 2 ? `Exactly two land masses (${odd.join(" and ")}) have an odd number of bridges: a walk exists, from one of them to the other.`
    : `${odd.length} land masses (${odd.join(", ")}) have an odd number of bridges: no walk can cross every bridge exactly once.`;
  degreeBox.replaceChildren(h("p", { class: "small", style: { margin: "4px 0 0" } },
    h("strong", {}, "Degrees: "), LANDS.map((L) => `${L} = ${degree(L)}`).join(", "), ". ", verdict,
    " Odd-degree nodes are ringed in red in the graph."));
  solveBtn.disabled = !eulerPath();
}
render();
f.setCaption("Each piece of land is a node, each bridge a link. Two pairs of land masses are joined by two bridges each, so this is a <em>multigraph</em>. In <em>Edit bridges</em> mode, dashed bridges are ones you can build. The book notes that a new bridge built in 1875 joined two land masses that each had three bridges, leaving only two odd-degree land masses, so the walk finally became possible.");

// ---------------------------------------------------------------- the reference networks (Table 2.1)
(async () => {
  const { networks } = await loadNetworks();
  const MEANING = {
    internet: ["Routers", "Internet connections"], www: ["Webpages", "Hyperlinks"], powergrid: ["Power plants, transformers", "Cables"],
    phonecalls: ["Subscribers", "Calls"], email: ["Email addresses", "Emails"], collaboration: ["Scientists", "Co-authorships"],
    metabolic: ["Metabolites", "Chemical reactions"], protein: ["Proteins", "Binding interactions"],
  };
  const rows = NETWORK_ORDER.map((n) => {
    const d = networks[n];
    return [d.description, MEANING[n][0], MEANING[n][1], d.originallyDirected ? "directed" : "undirected", d.N, d.L, d.avgk];
  });
  document.getElementById("tbl-networks").append(dataTable([
    { label: "Network", align: "left" }, { label: "Nodes", align: "left" }, { label: "Links", align: "left" }, { label: "Original data", align: "left" },
    { label: "N", format: fmt.int }, { label: "L (undirected)", format: fmt.int }, { tex: "\\langle k\\rangle = 2L/N", format: (v) => fmt.fix(v, 2) },
  ], rows));
})();
