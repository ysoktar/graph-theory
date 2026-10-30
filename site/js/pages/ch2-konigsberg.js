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

// Land masses: B north bank, C south bank, A the Kneiphof island, D the land between the two arms of the river.
// Coordinates are in the map's 640 × 400 viewBox: vertical bridges span y1 → y2 at x, horizontal ones x1 → x2 at y.
const LANDS = ["A", "B", "C", "D"];
const BRIDGES = [
  { id: "a", u: "A", v: "B", x: 190, y1: 112, y2: 172 },
  { id: "b", u: "A", v: "B", x: 292, y1: 112, y2: 170 },
  { id: "c", u: "A", v: "C", x: 190, y1: 230, y2: 290 },
  { id: "d", u: "A", v: "C", x: 292, y1: 232, y2: 288 },
  { id: "e", u: "A", v: "D", horizontal: true, y: 200, x1: 330, x2: 452 },
  { id: "f", u: "B", v: "D", x: 566, y1: 92, y2: 160 },
  { id: "g", u: "C", v: "D", x: 566, y1: 242, y2: 308 },
  { id: "h", u: "B", v: "C", x: 62, y1: 124, y2: 276, extra: true },
  { id: "i", u: "A", v: "D", horizontal: true, y: 226, x1: 322, x2: 478, extra: true },
].map((b) => ({ ...b, present: !b.extra }));
const bridgeMid = (b) => (b.horizontal ? [(b.x1 + b.x2) / 2, b.y] : [b.x, (b.y1 + b.y2) / 2]);

const state = { mode: "walk", start: null, current: null, used: [], lands: [], message: "", animating: null };

const f = figure("#fig-walk", { title: "The seven bridges of Königsberg", cols: "split" });
const mapPanel = f.panel("The city in 1736 (schematic)"), graphPanel = f.panel("Euler's abstraction: the graph");
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
const map = s("svg", { viewBox: "0 0 640 400", role: "img", "aria-label": "Schematic map of Königsberg: the river Pregel, its two banks, the Kneiphof island and the eastern land, joined by seven bridges", class: "kb-map" });
mapPanel.append(map);
mapPanel.append(h("div", { class: "kb-legend" },
  h("span", {}, h("i", { class: "kb-dot you" }), "you are here"),
  h("span", {}, h("i", { class: "kb-dot next" }), "bridges you can take next"),
  h("span", {}, h("i", { class: "kb-dot used" }), "crossed, numbered in order")));

// water: one channel in the west, two arms around the island A, and two arms around the eastern land D
const WATER = "M0,138 C120,126 250,112 420,128 C500,134 560,104 640,92 L640,308 C560,298 500,268 420,272 C250,288 120,276 0,262 Z";
const BANK_B = "M0,0 H640 V92 C560,104 500,134 420,128 C250,112 120,126 0,138 Z";
const BANK_C = "M0,400 H640 V308 C560,298 500,268 420,272 C250,288 120,276 0,262 Z";
const ISLAND_A = "M128,200 C128,170 188,158 244,158 C300,158 342,176 342,200 C342,226 298,242 240,242 C184,242 128,230 128,200 Z";
const LAND_D = "M640,150 C560,152 474,168 440,200 C474,232 560,248 640,250 Z";
const defs = s("defs");
defs.innerHTML = `
  <pattern id="kb-waves" width="26" height="12" patternUnits="userSpaceOnUse">
    <path d="M0 8 q6.5 -5 13 0 t13 0" fill="none" stroke="var(--kb-wave)" stroke-width="1.1" stroke-linecap="round"/>
  </pattern>
  <pattern id="kb-streets" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
    <path d="M0 0 H34 M0 0 V34" stroke="var(--kb-street)" stroke-width="1"/>
  </pattern>
  <marker id="kb-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="var(--s2)"/>
  </marker>`;
map.append(defs);
map.append(
  s("rect", { x: 0, y: 0, width: 640, height: 400, fill: "var(--kb-land)" }),
  s("rect", { x: 0, y: 0, width: 640, height: 400, fill: "url(#kb-streets)" }),
  s("path", { d: WATER, fill: "var(--kb-water)" }),
  s("path", { d: WATER, fill: "url(#kb-waves)" }),
  s("path", { d: WATER, fill: "none", stroke: "var(--kb-shore)", "stroke-width": 1.5 }),
);
const LAND_PATH = { B: BANK_B, C: BANK_C, A: ISLAND_A, D: LAND_D };
const landShapes = {};
for (const L of LANDS) {
  const g = s("g", { class: "kb-land", tabindex: 0, role: "button", "aria-label": `land ${L}` });
  const shape = s("path", { d: LAND_PATH[L], fill: L === "A" || L === "D" ? "var(--kb-land)" : "transparent", stroke: L === "A" || L === "D" ? "var(--kb-shore)" : "none", "stroke-width": 1.5 });
  g.append(shape);
  if (L === "A" || L === "D") g.append(s("path", { d: LAND_PATH[L], fill: "url(#kb-streets)", "pointer-events": "none" }));
  g.addEventListener("click", () => clickLand(L));
  g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); clickLand(L); } });
  map.append(g);
  landShapes[L] = { g, shape };
}
map.append(s("text", { x: 26, y: 205, class: "kb-river" }, "Pregel"));
map.append(s("text", { x: 506, y: 136, class: "kb-river", "text-anchor": "end" }, "Old Pregel"));
map.append(s("text", { x: 506, y: 274, class: "kb-river", "text-anchor": "end" }, "New Pregel"));
// compass
const compass = s("g", { transform: "translate(604,40)", class: "kb-compass", "aria-hidden": "true" });
compass.append(s("circle", { r: 15 }), s("path", { d: "M0,-11 L4,2 L0,-1 L-4,2 Z" }), s("text", { y: -18, "text-anchor": "middle" }, "N"));
map.append(compass);
// land labels: anchor point (where the walker stands), letter and historical name
const ANCHOR = { A: [214, 200], B: [330, 58], C: [330, 346], D: [584, 200] };
const NAME = { A: "Kneiphof island", B: "north bank", C: "south bank", D: "eastern land" };
// where the walker stands on each land: beside the letter, so that neither hides the other
const SPOT = { A: [258, 186], B: [374, 50], C: [374, 338], D: [548, 186] };
const landLabels = {};
for (const L of LANDS) {
  const [x, y] = ANCHOR[L];
  const g = s("g", { "pointer-events": "none" });
  const letter = s("text", { x, y: y + 2, "text-anchor": "middle", class: "kb-letter" }, L);
  const name = s("text", { x, y: y + 20, "text-anchor": "middle", class: "kb-name" }, NAME[L]);
  g.append(letter, name);
  map.append(g);
  landLabels[L] = { letter, name };
}
// bridges: a deck with two rails and a letter badge; a wide invisible hit area for clicking
const bridgeEls = {};
for (const b of BRIDGES) {
  const g = s("g", { class: "kb-bridge", tabindex: 0, role: "button", "aria-label": `bridge ${b.id} between ${b.u} and ${b.v}` });
  const [mx, my] = bridgeMid(b);
  let shadow, deck, rail1, rail2, hit;
  if (b.horizontal) {
    shadow = s("rect", { x: b.x1, y: b.y - 6, width: b.x2 - b.x1, height: 16, rx: 3, class: "kb-shadow" });
    deck = s("rect", { x: b.x1, y: b.y - 8, width: b.x2 - b.x1, height: 16, rx: 3, class: "kb-deck" });
    rail1 = s("line", { x1: b.x1 + 3, x2: b.x2 - 3, y1: b.y - 8, y2: b.y - 8, class: "kb-rail" });
    rail2 = s("line", { x1: b.x1 + 3, x2: b.x2 - 3, y1: b.y + 8, y2: b.y + 8, class: "kb-rail" });
    hit = s("rect", { x: b.x1, y: b.y - 16, width: b.x2 - b.x1, height: 32, fill: "transparent" });
  } else {
    shadow = s("rect", { x: b.x - 6, y: b.y1, width: 16, height: b.y2 - b.y1, rx: 3, class: "kb-shadow" });
    deck = s("rect", { x: b.x - 8, y: b.y1, width: 16, height: b.y2 - b.y1, rx: 3, class: "kb-deck" });
    rail1 = s("line", { x1: b.x - 8, x2: b.x - 8, y1: b.y1 + 3, y2: b.y2 - 3, class: "kb-rail" });
    rail2 = s("line", { x1: b.x + 8, x2: b.x + 8, y1: b.y1 + 3, y2: b.y2 - 3, class: "kb-rail" });
    hit = s("rect", { x: b.x - 18, y: b.y1, width: 36, height: b.y2 - b.y1, fill: "transparent" });
  }
  const bx = b.horizontal ? mx : mx + 22, by = b.horizontal ? my - 22 : my;
  const badge = s("circle", { cx: bx, cy: by, r: 11, class: "kb-badge" });
  const t = s("text", { x: bx, y: by + 4.5, "text-anchor": "middle", class: "kb-badge-text" }, b.id);
  g.append(shadow, deck, rail1, rail2, hit, badge, t);
  g.addEventListener("click", () => clickBridge(b));
  g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); clickBridge(b); } });
  map.append(g);
  bridgeEls[b.id] = { g, deck, badge, t };
}
// the route walked so far, and the walker
const trail = s("path", { class: "kb-trail", "marker-end": "url(#kb-arrow)" });
map.append(trail);
const walker = s("g", { class: "kb-walker", "aria-hidden": "true" });
walker.append(s("circle", { r: 12 }), s("circle", { r: 4, cy: -2.5, class: "kb-walker-head" }), s("path", { d: "M-5.5,7 Q0,0 5.5,7", class: "kb-walker-body" }));
map.append(walker);

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
  const left = present().filter((x) => !state.used.includes(x.id));
  const nextIds = new Set(state.mode === "walk" && state.current ? left.filter((x) => x.u === state.current || x.v === state.current).map((x) => x.id) : []);
  for (const b of BRIDGES) {
    const el = bridgeEls[b.id];
    const order = state.used.indexOf(b.id);
    el.g.style.display = b.present || state.mode === "edit" ? "" : "none";
    el.g.classList.toggle("absent", !b.present);
    el.g.classList.toggle("used", order >= 0);
    el.g.classList.toggle("next", nextIds.has(b.id));
    el.t.textContent = order >= 0 ? String(order + 1) : b.id;
    el.g.setAttribute("aria-label", `bridge ${b.id} between ${b.u} and ${b.v}${order >= 0 ? `, crossed as step ${order + 1}` : ""}${b.present ? "" : ", not built"}`);
  }
  for (const L of LANDS) {
    landShapes[L].g.classList.toggle("startable", state.mode === "walk" && !state.used.length && !state.animating);
    landShapes[L].g.classList.toggle("here", state.current === L);
    landLabels[L].letter.setAttribute("class", "kb-letter" + (state.current === L ? " here" : ""));
  }
  // trail: land → bridge midpoint → land …, offset a little so that it does not hide the letters
  if (state.start) {
    const pts = [SPOT[state.lands[0]]];
    state.used.forEach((id, i) => { pts.push(bridgeMid(BRIDGES.find((x) => x.id === id))); pts.push(SPOT[state.lands[i + 1]]); });
    // stop the arrow just short of the walker
    if (pts.length > 1) {
      const [x1, y1] = pts[pts.length - 2], [x2, y2] = pts[pts.length - 1], L = Math.hypot(x2 - x1, y2 - y1) || 1;
      pts[pts.length - 1] = [x2 - ((x2 - x1) / L) * 16, y2 - ((y2 - y1) / L) * 16];
    }
    trail.setAttribute("d", pts.length > 1 ? "M" + pts.map((p) => p.join(",")).join(" L") : "");
    const [wx, wy] = SPOT[state.current];
    walker.setAttribute("transform", `translate(${wx},${wy})`);
    walker.style.display = "";
  } else { trail.setAttribute("d", ""); walker.style.display = "none"; }
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
