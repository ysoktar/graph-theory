// Exam study guides. The practice set deals from the guide's own question bank (<template id="exam-questions">,
// one .quiz per question, grouped by data-topic): exam-style questions that give the formulas and ask to apply
// and interpret them. The stand-alone quizzes of the pages in the exam's scope can be added as review questions.
import { pageInfo, enhanceQuizzes, annotateGlossary } from "../layout.js";
import { h, $, $$, renderMath, button, select, checkbox } from "../lib/ui.js";
import { articleUrl, t } from "../i18n.js";

const bank = $("#bank");
const ids = (bank.dataset.pages || "").split(",").map((s) => s.trim()).filter(Boolean);
const optional = new Set((bank.dataset.optional || "").split(",").map((s) => s.trim()).filter(Boolean));
const file = (id) => (id === "index" ? "index.html" : `${id}.html`);

/** The guide's own questions, in page order. */
const own = (() => {
  const tpl = $("#exam-questions");
  return tpl ? $$(".quiz", tpl.content).map((q) => ({ topic: q.dataset.topic || "", html: q.outerHTML })) : [];
})();

/** Review questions: every stand-alone quiz (not marked data-local) of the pages in scope. */
async function collectPages() {
  const parser = new DOMParser();
  const pages = await Promise.all(ids.filter((id) => !optional.has(id)).map(async (id) => {
    try {
      let r = await fetch(articleUrl(id));
      if (!r.ok) r = await fetch(file(id)); // no translation yet: use the English questions
      const doc = parser.parseFromString(await r.text(), "text/html");
      return $$(".quiz:not([data-local])", doc).map((q) => ({ page: id, html: q.outerHTML }));
    } catch { return []; }
  }));
  return pages.flat();
}

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const topics = [...new Set(own.map((q) => q.topic))];
const on = new Set(topics);
let size = 10, review = null, withReview = false, answered = 0, correct = 0;

const score = h("span", { class: "bank-score", "aria-live": "polite" });
const list = h("div");
const paintScore = () => { score.textContent = answered ? t(`${correct} of ${answered} right on the first try`) : t("Answer a question to start the score."); };

function deal() {
  const pool = own.filter((q) => on.has(q.topic));
  if (withReview && review) pool.push(...review);
  const pick = shuffle(pool).slice(0, size || pool.length);
  answered = 0; correct = 0; paintScore();
  list.replaceChildren(...pick.map((q) => {
    const box = h("div", { html: q.html });
    if (q.page) {
      const info = pageInfo(q.page);
      box.append(h("div", { class: "quiz-src" }, t("Review question from") + " ", h("a", { href: file(q.page) }, info.title), info.book ? ` · ${t("Book")} ${info.book}` : ""));
    } else if (q.topic) box.append(h("div", { class: "quiz-src" }, q.topic));
    return box;
  }));
  if (!pick.length) list.append(h("p", { class: "muted" }, t("No questions selected: tick at least one topic above.")));
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

const topicBox = h("div", { class: "bank-topics" });
for (const tp of topics) {
  const input = h("input", { type: "checkbox" });
  input.checked = true;
  input.addEventListener("change", () => { if (input.checked) on.add(tp); else on.delete(tp); deal(); });
  topicBox.append(h("label", {}, input, `${tp} (${own.filter((q) => q.topic === tp).length})`));
}

const bar = h("div", { class: "bank-bar" });
button(bar, { label: t("New set"), icon: "dice", onClick: deal });
select(bar, { label: t("Questions"), value: String(size), options: [{ value: "5", label: "5" }, { value: "10", label: "10" }, { value: "20", label: "20" }, { value: "0", label: t("all") }], onChange: (v) => { size = Number(v); deal(); } });
if (ids.length) {
  checkbox(bar, {
    label: t("Add review questions from the pages"),
    onChange: async (v) => {
      withReview = v;
      if (v && !review) { score.textContent = t("Loading questions…"); review = await collectPages(); }
      deal();
    },
  });
}
bar.append(score);
bank.replaceChildren(
  h("p", { class: "muted small" }, t(`${own.length} exam-style questions. Each gives the formulas it needs and asks you to use them and interpret the result. Tick the topics you want; each set is drawn at random.`)),
  topicBox, bar, list);
deal();
