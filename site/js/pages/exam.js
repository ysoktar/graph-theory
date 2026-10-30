// Exam study guides: the page text is static; the practice set below it is assembled from the
// quizzes of every page in the exam's scope, so it grows whenever a page gains a question.
import { NAV, pageInfo, enhanceQuizzes, annotateGlossary } from "../layout.js";
import { h, $, $$, renderMath, button, select } from "../lib/ui.js";
import { articleUrl } from "../i18n.js";

const bank = $("#bank");
const ids = bank.dataset.pages.split(",").map((s) => s.trim()).filter(Boolean);
const optional = new Set((bank.dataset.optional || "").split(",").map((s) => s.trim()).filter(Boolean));
const file = (id) => (id === "index" ? "index.html" : `${id}.html`);

/** One entry per stand-alone quiz (quizzes marked data-local need their page's figure and are skipped). */
async function collect() {
  const parser = new DOMParser();
  const pages = await Promise.all(ids.map(async (id) => {
    try {
      let r = await fetch(articleUrl(id));
      if (!r.ok) r = await fetch(file(id)); // no translation yet: use the English questions
      const doc = parser.parseFromString(await r.text(), "text/html");
      return $$(".quiz:not([data-local])", doc).map((q) => ({ id, html: q.outerHTML }));
    } catch { return []; }
  }));
  return pages.flat();
}

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

(async () => {
  bank.textContent = "Loading questions…";
  const all = await collect();
  const parts = NAV.filter((p) => p.items.some((it) => ids.includes(it.id)));
  const on = new Set(ids.filter((id) => !optional.has(id)));
  let size = 15, answered = 0, correct = 0;

  const score = h("span", { class: "bank-score", "aria-live": "polite" });
  const list = h("div");
  const topics = h("div", { class: "bank-topics" });
  const paintScore = () => { score.textContent = answered ? `${correct} of ${answered} right on the first try` : "Answer a question to start the score."; };

  for (const p of parts) {
    for (const it of p.items.filter((x) => ids.includes(x.id))) {
      const n = all.filter((q) => q.id === it.id).length;
      const input = h("input", { type: "checkbox" });
      input.checked = on.has(it.id);
      input.addEventListener("change", () => { if (input.checked) on.add(it.id); else on.delete(it.id); deal(); });
      topics.append(h("label", { title: p.part }, input, `${it.title} (${n})`));
    }
  }

  function deal() {
    const pool = shuffle(all.filter((q) => on.has(q.id)));
    const pick = size ? pool.slice(0, size) : pool;
    answered = 0; correct = 0; paintScore();
    list.replaceChildren(...pick.map((q) => {
      const box = h("div", { html: q.html });
      const info = pageInfo(q.id);
      box.append(h("div", { class: "quiz-src" }, "From ", h("a", { href: file(q.id) }, info.title), info.book ? ` · Book ${info.book}` : ""));
      return box;
    }));
    if (!pick.length) list.append(h("p", { class: "muted" }, "No questions selected: tick at least one page above."));
    enhanceQuizzes(list);
    renderMath(list);
    annotateGlossary(list, "exam", { quizzesOnly: true });
  }

  list.addEventListener("quizanswer", (e) => {
    if (!e.detail.firstTry) return;
    answered++;
    if (e.detail.correct) correct++;
    paintScore();
  });

  const bar = h("div", { class: "bank-bar" });
  button(bar, { label: "New set", icon: "dice", onClick: deal });
  select(bar, { label: "Questions", value: String(size), options: [{ value: "10", label: "10" }, { value: "15", label: "15" }, { value: "30", label: "30" }, { value: "0", label: `all ${all.length}` }], onChange: (v) => { size = Number(v); deal(); } });
  bar.append(score);
  bank.replaceChildren(
    h("p", { class: "muted small" }, `${all.length} questions from ${ids.length} pages. Tick the pages you want; each set is drawn at random.`),
    topics, bar, list);
  deal();
})();
