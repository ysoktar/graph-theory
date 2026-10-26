// UI building blocks: DOM helper, controls, stat tiles, tooltip, maths rendering, theme events.

/** Tiny hyperscript: h("div", {class: "x", onclick: f}, "text", child, …). Strings become text nodes (never HTML). */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "html") el.innerHTML = v; // only ever used with trusted, hard-coded markup
    else if (k === "dataset") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Render LaTeX into an element (KaTeX is loaded globally by every page). */
export function tex(el, latex, display = false) {
  if (window.katex) window.katex.render(latex, el, { displayMode: display, throwOnError: false });
  else el.textContent = latex;
  return el;
}
export const texEl = (latex, display = false, tag = "span") => tex(h(tag), latex, display);

/** Render $…$ / $$…$$ in a subtree (for content added after page load). */
export function renderMath(root) {
  if (window.renderMathInElement) {
    window.renderMathInElement(root, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
      ],
      throwOnError: false,
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option"],
    });
  }
}

let uid = 0;
const nextId = (p) => `${p}-${++uid}`;

/**
 * Range slider. opts: {label, min, max, step, value, format, log, onInput, onChange, wide, title}
 * With log: true the slider moves in log10 space (for N, p, …) and `step` applies to the real value.
 */
export function slider(parent, opts) {
  const { label, min, max, step = 1, value, format = (v) => String(v), log = false, onInput, onChange, wide, title } = opts;
  const id = nextId("sl");
  const out = h("span", { class: "ctl-value", id: id + "-v" });
  const input = h("input", { type: "range", id, "aria-label": typeof label === "string" ? label : undefined, title });
  const toPos = (v) => (log ? Math.log10(v) : v);
  const fromPos = (p) => {
    let v = log ? Math.pow(10, p) : p;
    if (step) v = Math.round(v / step) * step;
    return Math.min(max, Math.max(min, +v.toFixed(10)));
  };
  input.min = toPos(min); input.max = toPos(max);
  input.step = log ? (toPos(max) - toPos(min)) / 400 : step;
  const labelEl = h("label", { class: "ctl-label", for: id }, h("span", {}, label), out);
  const el = h("div", { class: "ctl" + (wide ? " wide" : "") }, labelEl, input);
  let current = value;
  const paint = () => {
    out.textContent = format(current);
    const f = ((+input.value - +input.min) / (+input.max - +input.min)) * 100;
    input.style.setProperty("--fill", f + "%");
  };
  const api = {
    el, input,
    get value() { return current; },
    set value(v) { current = v; input.value = toPos(v); paint(); },
    setRange(lo, hi) { input.min = toPos(lo); input.max = toPos(hi); paint(); },
  };
  input.addEventListener("input", () => { current = fromPos(+input.value); paint(); onInput && onInput(current); });
  input.addEventListener("change", () => onChange && onChange(current));
  api.value = value;
  parent && parent.append(el);
  return api;
}

/** Segmented control (mutually exclusive buttons). options: [{value, label}] */
export function segmented(parent, { label, options, value, onChange }) {
  const wrap = h("div", { class: "seg", role: "group", "aria-label": label });
  let current = value;
  const buttons = options.map((o) => {
    const b = h("button", { type: "button", "aria-pressed": String(o.value === value), title: o.title }, o.label);
    b.addEventListener("click", () => { api.value = o.value; onChange && onChange(o.value); });
    wrap.append(b);
    return b;
  });
  const el = label ? h("div", { class: "ctl", style: { minWidth: "auto" } }, h("span", { class: "ctl-label" }, label), wrap) : wrap;
  const api = {
    el,
    get value() { return current; },
    set value(v) { current = v; buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(options[i].value === v))); },
  };
  parent && parent.append(el);
  return api;
}

export function select(parent, { label, options, value, onChange }) {
  const id = nextId("sel");
  const s = h("select", { id });
  for (const o of options) s.append(h("option", { value: o.value }, o.label));
  s.value = value;
  s.addEventListener("change", () => onChange && onChange(s.value));
  const el = h("div", { class: "ctl", style: { minWidth: "auto" } }, h("label", { class: "ctl-label", for: id }, label), s);
  parent && parent.append(label ? el : s);
  return { el: label ? el : s, get value() { return s.value; }, set value(v) { s.value = v; } };
}

export function button(parent, { label, onClick, kind = "", title, icon }) {
  const b = h("button", { type: "button", class: "btn " + kind, title }, icon ? h("span", { html: ICONS[icon] || "" }) : null, label);
  b.addEventListener("click", onClick);
  parent && parent.append(b);
  return b;
}

export function checkbox(parent, { label, checked = false, onChange }) {
  const input = h("input", { type: "checkbox" });
  input.checked = checked;
  input.addEventListener("change", () => onChange && onChange(input.checked));
  const el = h("label", { class: "check" }, input, label);
  parent && parent.append(el);
  return { el, input, get value() { return input.checked; }, set value(v) { input.checked = v; } };
}

/** Stat tiles. items: [{key, label, sub?}] → returns {set(key, value, sub?)} */
export function stats(parent, items) {
  const wrap = h("div", { class: "stats" });
  const map = {};
  for (const it of items) {
    const v = h("div", { class: "stat-value" }, "–");
    const s = h("div", { class: "stat-sub" }, it.sub || "");
    const lab = h("div", { class: "stat-label" });
    if (it.tex) tex(lab, it.tex); else lab.textContent = it.label;
    if (it.tex && it.label) lab.append(" ", it.label);
    const tile = h("div", { class: "stat" + (it.hl ? " hl" : ""), title: it.title }, lab, v, s);
    map[it.key] = { v, s, tile };
    wrap.append(tile);
  }
  parent && parent.append(wrap);
  return {
    el: wrap,
    set(key, value, sub) {
      const t = map[key];
      if (!t) return;
      t.v.textContent = value;
      if (sub !== undefined) t.s.textContent = sub;
    },
    tile: (key) => map[key]?.tile,
  };
}

// ---------------------------------------------------------------- figure scaffolding

/**
 * Builds a figure card inside `host` (an element or a selector):
 *   <div class="fig"><div class="fig-head">title/sub</div><div class="fig-controls"/><div class="fig-body"/><p class="fig-caption"/></div>
 */
export function figure(host, { title, sub, cols, caption, id } = {}) {
  const root = typeof host === "string" ? document.querySelector(host) : host;
  const head = h("div", { class: "fig-head" }, h("div", {}, title ? h("h3", { class: "fig-title" }, title) : null, sub ? h("p", { class: "fig-sub" }, sub) : null));
  const controls = h("div", { class: "fig-controls" });
  const body = h("div", { class: "fig-body" + (cols ? " " + cols : "") });
  const cap = h("p", { class: "fig-caption" });
  if (caption) { cap.innerHTML = caption; renderMath(cap); }
  const el = h("div", { class: "fig", id }, title || sub ? head : null, controls, body, cap);
  if (root) {
    // a placeholder <div data-fig> is replaced; anything else gets the figure appended
    if (root.hasAttribute && root.hasAttribute("data-fig")) {
      const hostCaption = root.innerHTML.trim();
      if (hostCaption && !caption) { cap.innerHTML = hostCaption; renderMath(cap); }
      root.replaceWith(el);
    } else root.append(el);
  }
  const setCaption = (html) => { cap.innerHTML = html; renderMath(cap); };
  return { el, head, controls, body, caption: cap, setCaption, panel: (title2, cls = "") => panel(body, title2, cls) };
}
export function panel(parent, title, cls = "") {
  const p = h("div", { class: "panel " + cls }, title ? h("div", { class: "panel-title" }, title) : null);
  parent.append(p);
  return p;
}

// ---------------------------------------------------------------- tooltip

let tipEl = null;
export function tooltip() {
  if (!tipEl) {
    tipEl = h("div", { class: "tooltip", role: "tooltip" });
    document.body.append(tipEl);
  }
  return {
    show(x, y, content) {
      tipEl.replaceChildren(...(Array.isArray(content) ? content : [content]));
      tipEl.classList.add("show");
      const r = tipEl.getBoundingClientRect();
      let left = x + 14, top = y + 14;
      if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
      if (top + r.height > window.innerHeight - 8) top = y - r.height - 14;
      tipEl.style.left = Math.max(8, left) + "px";
      tipEl.style.top = Math.max(8, top) + "px";
    },
    hide() { tipEl.classList.remove("show"); },
  };
}
/** Tooltip row: value first (strong), label after, keyed by a short line of the series colour. */
export function ttRow(value, label, colorClass) {
  return h("div", { class: "tt-row" }, colorClass ? h("span", { class: "tt-key " + colorClass }) : null, h("b", {}, value), h("span", { class: "tt-dim" }, label));
}

// ---------------------------------------------------------------- theme

const themeListeners = new Set();
export function onThemeChange(fn) { themeListeners.add(fn); return () => themeListeners.delete(fn); }
export function emitThemeChange() { for (const fn of themeListeners) fn(); }
if (typeof window !== "undefined" && window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", emitThemeChange);
}

/** Resolve a colour token ("s1", "random", "text", "#hex") to a concrete colour for canvas drawing. */
const tokenCache = new Map();
onThemeChange(() => tokenCache.clear());
export function color(token) {
  if (!token) return "#888";
  if (token[0] === "#" || token.startsWith("rgb")) return token;
  if (tokenCache.has(token)) return tokenCache.get(token);
  const v = getComputedStyle(document.documentElement).getPropertyValue("--" + token).trim() || token;
  tokenCache.set(token, v);
  return v;
}
/** Series colour class for SVG/HTML: 1..8 → "c1".., or a named token. */
export const colorClass = (c) => (typeof c === "number" ? "c" + c : c ? "c-" + c : "c1");

// ---------------------------------------------------------------- misc

export function rafThrottle(fn) {
  let pending = false, lastArgs;
  return (...args) => {
    lastArgs = args;
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; fn(...lastArgs); });
  };
}
export function debounce(fn, ms = 150) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/** Run fn when the element first scrolls into view (keeps heavy figures from blocking page load). */
export function whenVisible(el, fn) {
  if (!("IntersectionObserver" in window)) { fn(); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
  }, { rootMargin: "200px" });
  io.observe(el);
}

/** Simple data table from rows of cells; columns: [{label, align, format}] */
export function dataTable(columns, rows, { highlight } = {}) {
  const thead = h("thead", {}, h("tr", {}, columns.map((c) => {
    const th = h("th", { class: c.align === "left" ? "left" : "" });
    if (c.tex) tex(th, c.tex); else th.textContent = c.label;
    if (c.title) th.title = c.title;
    return th;
  })));
  const tbody = h("tbody", {}, rows.map((r, i) => h("tr", { class: highlight && highlight(r, i) ? "hl" : "" }, columns.map((c, j) => {
    const v = r[j];
    const td = h("td", { class: (c.align === "left" ? "left " : "") + (c.cls ? c.cls(v, r) : "") });
    if (v instanceof Node) td.append(v); else td.textContent = c.format ? c.format(v, r) : v ?? "–";
    return td;
  }))));
  return h("div", { class: "table-scroll" }, h("table", { class: "data" }, thead, tbody));
}

export const ICONS = {
  play: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l9-5.5z"/></svg>',
  pause: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/></svg>',
  step: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M3 2.5v11l7-5.5zM11 2.5h2v11h-2z"/></svg>',
  reset: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8a5 5 0 1 0 1.5-3.6M3 3v3h3"/></svg>',
  dice: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="2.5" width="11" height="11" rx="2.5"/><circle cx="5.5" cy="5.5" r=".9" fill="currentColor"/><circle cx="10.5" cy="10.5" r=".9" fill="currentColor"/><circle cx="8" cy="8" r=".9" fill="currentColor"/></svg>',
};

export const CALLOUT_ICONS = {
  look: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>',
  discuss: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" stroke-linejoin="round"/></svg>',
  key: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 1.8l1.8 3.9 4.2.5-3.1 2.9.8 4.2L8 11.2l-3.7 2.1.8-4.2L2 6.2l4.2-.5z" stroke-linejoin="round"/></svg>',
  gotcha: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 2l6.5 11.5h-13z" stroke-linejoin="round"/><path d="M8 6.5v3.2M8 11.6v.1"/></svg>',
  try: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8.5l2.5 2.5L12 5"/><rect x="1.8" y="1.8" width="12.4" height="12.4" rx="3"/></svg>',
  note: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6.2"/><path d="M8 7v4.2M8 4.7v.1"/></svg>',
  fix: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10.5 2.5l3 3-7.5 7.5H3v-3z" stroke-linejoin="round"/><path d="M9 4l3 3"/></svg>',
};
