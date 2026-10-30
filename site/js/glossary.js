import { LANG } from "./i18n.js";

// One glossary for the whole site. The formula page lists it; on every other page the first use of a term
// (and its first use inside each quiz) gets a dotted underline that shows the definition on hover or tap.
// `match` is a regular-expression source for the words that count as the term (default: the term itself);
// `skip` lists pages where the word means something else.

export const GLOSSARY = [
  // ---- basic objects
  { term: "Node", def: "A unit of the system: a person, a web page, a protein… Also called a vertex.", match: "nodes?|vert(?:ex|ices)" },
  { term: "Link", def: "A connection between two nodes: a friendship, a hyperlink, a binding… Also called an edge.", match: "links?|edges?(?! of)" },
  { term: "Network", def: "A set of nodes and the links between them. Mathematicians call it a graph.", match: "graphs?(?! theory| convolutional)" },
  { term: "Directed network", def: "Links have a direction (A → B is not B → A), like hyperlinks, emails or phone calls. Each node has an in-degree (links arriving) and an out-degree (links leaving).", match: "directed(?: networks?| links?| graphs?)?" },
  { term: "Undirected network", def: "Links have no direction: if A is linked to B, B is linked to A, like friendships or co-authorship.", match: "undirected(?: networks?| links?| graphs?)?" },
  { term: "Weighted network", def: "Each link carries a number (its weight): call minutes, number of shared papers, traffic.", match: "weighted(?: networks?| links?)?" },
  { term: "Bipartite network", def: "Two kinds of nodes (e.g. women and events) with links only between the kinds. Its projection links two nodes of one kind when they share a neighbour.", match: "bipartite(?: networks?| graphs?)?" },
  { term: "Simple network", def: "No self-loops (a link from a node to itself) and no multi-links (two links between the same pair).", match: "simple (?:networks?|graphs?)" },
  { term: "Self-loop", def: "A link from a node to itself.", match: "self-loops?" },
  { term: "Multi-link", def: "Two or more links between the same pair of nodes; a network that allows them is a multigraph.", match: "multi-?links?|multigraphs?" },
  { term: "Complete graph", def: "Every pair of nodes is linked: N(N − 1)/2 links, the maximum L_max. Also called a clique.", match: "complete (?:graphs?|networks?)|cliques?" },
  { term: "Star", def: "One central node (the hub) linked to every other node; the others (leaves) have degree 1 and no links among themselves.", match: "stars?|star-like" },
  { term: "Ring", def: "Nodes arranged in a circle, each linked to its two neighbours: every degree is 2.", match: "rings?" },
  { term: "Path graph", def: "Nodes in a line, each linked to the next: the two ends have degree 1, the rest degree 2.", match: "path graphs?" },
  { term: "Tree", def: "A connected network with no cycles: N nodes and exactly N − 1 links, one path between any two nodes.", match: "trees?" },
  { term: "Leaf", def: "A node of degree 1.", match: "leaf(?: nodes?)?|(?<=(?:\\d|two|three|four|five|six|ten|20|its|the|all) )leaves", skip: ["ch2-konigsberg"] },
  { term: "Cycle", def: "A path that returns to its start without repeating a node, like a triangle A–B–C–A.", match: "cycles?" },
  // ---- degree
  { term: "Degree", def: "k_i, the number of links of node i. In a directed network: in-degree (arriving) and out-degree (leaving).", match: "degrees?" },
  { term: "Average degree", def: "⟨k⟩ = 2L/N, the mean number of links per node (each link adds 1 to two degrees).", match: "average degree|mean degree" },
  { term: "Degree distribution", def: "p_k, the fraction of nodes with degree k (the probability that a random node has k links).", match: "degree distributions?" },
  { term: "Degree sequence", def: "The list of all N degrees, e.g. (3, 2, 2, 1).", match: "degree sequences?" },
  { term: "Hub", def: "A node with far more links than the average node.", match: "hubs?" },
  { term: "Handshaking lemma", def: "Σ k_i = 2L: summing the degrees counts every link twice, once from each end.", match: "handshak(?:ing|e) (?:lemma|theorem)" },
  { term: "Adjacency matrix", def: "N×N table A with A_ij = 1 if i and j are linked, 0 otherwise; symmetric for undirected networks.", match: "adjacency matri(?:x|ces)" },
  { term: "Sparse network", def: "L ≪ L_max: only a tiny fraction of all possible links exist (⟨k⟩ ≪ N). Real networks are sparse.", match: "sparse(?: networks?)?|sparsity" },
  { term: "Density", def: "L / L_max, the fraction of possible links that exist; L_max = N(N − 1)/2.", match: "(?<!probability |degree )density" },
  // ---- paths
  { term: "Walk", def: "Any sequence of nodes in which each is linked to the next; nodes and links may repeat.", match: "walks?", skip: ["ch2-konigsberg"] },
  { term: "Path", def: "A walk that visits each node at most once.", match: "paths?" },
  { term: "Shortest path", def: "A path with the fewest links between two nodes; its length is their distance d.", match: "shortest paths?|geodesics?" },
  { term: "Distance", def: "d_ij, the number of links on the shortest path between i and j.", match: "(?<!physical )distances?", skip: ["ch2-konigsberg"] },
  { term: "Diameter", def: "d_max, the largest distance between any two nodes.", match: "diameters?" },
  { term: "Average distance", def: "⟨d⟩, the distance averaged over all pairs of nodes (also: average path length).", match: "average (?:distance|path length)s?" },
  { term: "BFS", def: "Breadth-first search: label the start 0, its neighbours 1, their unlabelled neighbours 2, … The labels are the distances.", match: "BFS|breadth-first search" },
  { term: "Eulerian path", def: "A walk that uses every link exactly once. Exists in a connected network if 0 or 2 nodes have odd degree.", match: "Euler(?:ian)? (?:paths?|walks?|trails?|circuits?)" },
  { term: "Betweenness", def: "How many shortest paths between other pairs pass through a node (or link).", match: "betweenness(?: centrality)?" },
  // ---- connectedness
  { term: "Connected", def: "A network is connected when a path joins every pair of nodes.", match: "(?<!most |well[- ]|best )connected", skip: ["ch3-real-degrees"] },
  { term: "Component", def: "A largest set of nodes all joined by paths; a network falls apart into components.", match: "components?", skip: ["ch1-intro", "ch2-konigsberg"] },
  { term: "Giant component", def: "A component that contains a finite fraction of all nodes, however large the network grows.", match: "giant components?|largest connected components?|LCC" },
  { term: "Bridge", def: "A link whose removal splits a component in two.", match: "(?<!hubs )bridges?", skip: ["ch2-konigsberg"] },
  { term: "Articulation point", def: "A node whose removal splits a component.", match: "articulation points?|cut vert(?:ex|ices)" },
  // ---- clustering
  { term: "Triangle", def: "Three nodes all linked to each other.", match: "triangles?" },
  { term: "Clustering coefficient", def: "C_i = 2L_i / (k_i(k_i − 1)): the fraction of pairs of i's neighbours that are linked to each other (0 to 1).", match: "clustering coefficients?|local clustering" },
  { term: "Global clustering", def: "C_Δ = 3 × triangles / connected triples: the chance that two neighbours of a node are linked, counted over the whole network.", match: "global clustering(?: coefficient)?|transitivity" },
  // ---- random networks
  { term: "Random network", def: "N nodes, each pair linked with the same probability p (Erdős–Rényi / Gilbert model). The baseline that real networks are compared with.", match: "random (?:networks?|graphs?)|Erd[őo]s[–-]R[ée]nyi" },
  { term: "G(N, p)", def: "Gilbert's random network: N nodes, each pair linked independently with probability p. G(N, L) (Erdős–Rényi) instead places exactly L links at random.", match: "G\\(N, ?[pL]\\)" },
  { term: "Null model", def: "A random reference network that keeps some properties of the data (N, L, or the degrees) and randomises the rest; differences from it need an explanation.", match: "null models?" },
  { term: "Binomial distribution", def: "Probability of k successes in n independent tries of probability p: C(n, k) pᵏ (1 − p)ⁿ⁻ᵏ. A random network's degrees are binomial with n = N − 1.", match: "binomial(?: distributions?)?" },
  { term: "Poisson distribution", def: "p_k = e^(−⟨k⟩) ⟨k⟩ᵏ / k!, the binomial for large N and small p. Narrow: almost every node has a degree close to ⟨k⟩, so no hubs.", match: "Poisson(?: distributions?)?" },
  { term: "Phase transition", def: "An abrupt change of large-scale behaviour at a critical value of a parameter; here the giant component appearing at ⟨k⟩ = 1.", match: "phase transitions?" },
  { term: "Critical point", def: "The parameter value of a phase transition, e.g. ⟨k⟩ = 1 for the giant component of a random network.", match: "critical points?|critical thresholds?" },
  { term: "Small world", def: "Average distance grows only like ln N: any two nodes are a few steps apart even in a huge network.", match: "small[- ]worlds?(?: property| effect)?" },
  { term: "Six degrees of separation", def: "Milgram's 1967 finding that letters reached a stranger through about six acquaintances on average.", match: "six degrees(?: of separation)?" },
  { term: "Watts–Strogatz model", def: "Start from a ring lattice (high clustering), rewire a fraction of links at random (short distances): small world with clustering.", match: "Watts[–-]Strogatz(?: model)?" },
  // ---- scale-free
  { term: "Power law", def: "p_k ∝ k^(−γ): doubling k divides p_k by the same factor 2^γ everywhere, so it is a straight line on log-log axes.", match: "power[- ]laws?" },
  { term: "Scale-free network", def: "A network whose degree distribution follows a power law; it has hubs and no typical degree.", match: "scale-free(?: networks?| property)?" },
  { term: "Degree exponent", def: "γ in p_k ∝ k^(−γ); smaller γ means more and bigger hubs. Most real networks have 2 < γ < 3.", match: "degree exponents?" },
  { term: "Heavy tail", def: "Large values are far more likely than in a Poisson or exponential distribution; a power law is one example.", match: "heavy[- ]tail(?:ed|s)?|fat[- ]tail(?:ed|s)?" },
  { term: "Natural cutoff", def: "k_max ≈ k_min N^(1/(γ−1)), the expected largest degree of a power law with N nodes.", match: "natural cutoffs?" },
  { term: "Moment", def: "⟨kⁿ⟩ = Σ kⁿ p_k. The first is ⟨k⟩; the second ⟨k²⟩ sets the spread σ² = ⟨k²⟩ − ⟨k⟩² and diverges for γ < 3.", match: "moments?" },
  { term: "Ultra-small world", def: "Distances grow like ln ln N, even slower than ln N: scale-free networks with 2 < γ < 3.", match: "ultra-small(?: worlds?)?" },
  { term: "Log binning", def: "Bins whose width grows by a constant factor (1–2, 2–4, 4–8…), so the sparse tail of p_k still gets enough nodes per bin.", match: "log(?:arithmic)?[- ]bin(?:ning|s)?" },
  { term: "CCDF", def: "Complementary cumulative distribution P(K ≥ k), the fraction of nodes with at least k links; for a power law its slope is −(γ − 1).", match: "CCDF|complementary cumulative(?: distribution)?" },
  { term: "Maximum likelihood", def: "Choose the parameter (here γ) under which the observed data are most probable; the standard way to fit a power law.", match: "maximum[- ]likelihood|MLE" },
  { term: "KS distance", def: "Kolmogorov–Smirnov distance: the largest gap between the data's cumulative distribution and the model's.", match: "KS (?:distance|statistic|test)|Kolmogorov[–-]Smirnov(?: distance| statistic| test)?" },
  { term: "k_min", def: "The degree from which the power-law tail is fitted; smaller degrees are ignored.", match: "k_min" },
  { term: "Configuration model", def: "A random network with a given degree sequence: give each node k_i stubs (half-links) and pair the stubs at random.", match: "configuration models?" },
  { term: "Degree-preserving randomization", def: "Swap the ends of random link pairs many times: every degree stays, everything else is randomised. A null model for 'is it just the degrees?'.", match: "degree-preserving randomi[sz]ations?|link swaps?" },
  // ---- BA model and evolving networks
  { term: "Preferential attachment", def: "New nodes link to existing node i with probability Π(k_i) = k_i / Σ_j k_j: the rich get richer.", match: "preferential attachment" },
  { term: "Barabási–Albert model", def: "Growth (one new node with m links per step) + preferential attachment. Produces a power law with γ = 3.", match: "Barab[áa]si[–-]Albert(?: model)?|BA model" },
  { term: "First-mover advantage", def: "In the BA model the oldest nodes end up with the most links: k_i(t) = m (t / t_i)^(1/2).", match: "first-mover advantage" },
  { term: "Fitness", def: "η_i, a node's intrinsic attractiveness in the Bianconi–Barabási model: Π ∝ η_i k_i, so a fit latecomer can overtake older hubs.", match: "fitness(?:es)?" },
  { term: "Bianconi–Barabási model", def: "The BA model with fitness: attachment ∝ η_i k_i. Explains why young nodes (Google) can become the biggest hubs.", match: "Bianconi[–-]Barab[áa]si(?: model)?" },
  { term: "Bose–Einstein condensation", def: "In the fitness model, a regime where the fittest node keeps a finite fraction of all links: winner takes all.", match: "Bose[–-]Einstein(?: condensation| condensate)?" },
  // ---- correlations
  { term: "Degree correlations", def: "Whether a node's degree tells you its neighbours' degrees: do hubs link to hubs?", match: "degree correlations?" },
  { term: "Assortative", def: "Hubs tend to link to hubs and small nodes to small nodes (r > 0); typical of social networks.", match: "assortative(?: mixing| networks?)?|assortativity" },
  { term: "Disassortative", def: "Hubs tend to link to small-degree nodes (r < 0); typical of technological and biological networks.", match: "disassortative(?: networks?)?" },
  { term: "Neutral network", def: "No degree correlations (r ≈ 0): neighbours' degrees are what random wiring would give.", match: "neutral(?: networks?)?" },
  { term: "Degree correlation coefficient", def: "r, between −1 and 1: the Pearson correlation of the degrees at the two ends of a link.", match: "degree correlation coefficients?|assortativity coefficients?" },
  { term: "k_nn(k)", def: "Average degree of the neighbours of nodes with degree k; rising = assortative, falling = disassortative.", match: "k_nn" },
  { term: "Structural cutoff", def: "k_s ≈ √(⟨k⟩N): above it a simple network cannot hold as many hub–hub links as random wiring expects, which forces disassortativity.", match: "structural cutoffs?" },
  { term: "Friendship paradox", def: "Your friends have more friends than you, on average: a random neighbour has ⟨k²⟩/⟨k⟩ links, more than ⟨k⟩.", match: "friendship paradox" },
  // ---- robustness and spreading
  { term: "Robustness", def: "How well a network stays connected (keeps its giant component) as nodes or links are removed.", match: "robustness" },
  { term: "Percolation", def: "Keep each node (or link) with some probability and ask whether a giant component survives.", match: "percolation" },
  { term: "Random failure", def: "Removing nodes chosen at random; mostly hits small nodes in a scale-free network.", match: "random failures?" },
  { term: "Targeted attack", def: "Removing the highest-degree nodes first; breaks scale-free networks quickly.", match: "targeted attacks?|attacks?" },
  { term: "Molloy–Reed criterion", def: "A giant component exists when κ = ⟨k²⟩/⟨k⟩ > 2.", match: "Molloy[–-]Reed(?: criterion)?" },
  { term: "κ (kappa)", def: "⟨k²⟩/⟨k⟩, the average degree of a node reached by following a random link.", match: "kappa" },
  { term: "Cascading failure", def: "A failure that overloads neighbours, which fail in turn, e.g. a power blackout.", match: "cascad(?:es?|ing failures?|ing)" },
  { term: "Epidemic threshold", def: "The spreading rate above which an outbreak can reach a finite fraction of the network; vanishes in large scale-free networks.", match: "epidemic thresholds?" },
  { term: "Transmissibility", def: "T, the probability that an infection passes along one link before the infected node recovers.", match: "transmissibility" },
  // ---- communities
  { term: "Community", def: "A group of nodes with many more links inside than to the rest of the network.", match: "communit(?:y|ies)" },
  { term: "Modularity", def: "Q: links inside communities minus the number expected by random wiring with the same degrees. Higher is a better split.", match: "modularity" },
  { term: "Resolution limit", def: "Modularity cannot see communities smaller than about √(2L) total degree: it merges them with a neighbour.", match: "resolution limits?" },
  // ---- graph ML
  { term: "Node embedding", def: "A vector of numbers for each node, chosen so that nodes close in the network get close vectors; lets standard ML use network structure.", match: "(?:node )?embeddings?" },
  { term: "Link prediction", def: "Ranking the unlinked pairs by how likely they are to be (or become) linked.", match: "link prediction" },
  { term: "AUC", def: "Area under the ROC curve: the chance that a true link scores higher than a non-link; 0.5 = guessing, 1 = perfect.", match: "AUC" },
  { term: "Laplacian", def: "L = D − A (degree matrix minus adjacency matrix). Its eigenvectors give spectral embeddings and cuts.", match: "Laplacians?" },
  { term: "Fiedler vector", def: "Laplacian eigenvector of the second-smallest eigenvalue; the signs of its entries split the network in two.", match: "Fiedler vectors?" },
  { term: "Random walk", def: "Move from node to node by repeatedly stepping to a random neighbour.", match: "random walks?|random-walk" },
  { term: "DeepWalk", def: "Embedding method: treat random walks as sentences and node IDs as words, then train word2vec (skip-gram).", match: "DeepWalk" },
  { term: "node2vec", def: "DeepWalk with biased random walks (parameters p, q) that trade breadth-first and depth-first exploration.", match: "node2vec" },
  { term: "Skip-gram", def: "word2vec's training task: from one item, predict the items near it in a sequence.", match: "skip-?gram|word2vec" },
  { term: "GNN", def: "Graph neural network: each layer updates a node's vector from its neighbours' vectors (message passing).", match: "GNNs?|graph neural networks?|GCNs?" },
  { term: "Message passing", def: "Each node collects its neighbours' vectors, aggregates them (sum, mean…) and updates its own.", match: "message passing" },
];

/** Symbols: an inline formula whose whole TeX source is one of these gets the same underline. */
export const SYMBOLS = [
  { tex: ["N"], term: "N", def: "Number of nodes." },
  { tex: ["L"], term: "L", def: "Number of links.", skip: ["embeddings", "communities"] },
  { tex: ["k", "k_i"], term: "k, kᵢ", def: "Degree: the number of links of a node (of node i)." },
  { tex: ["\\langlek\\rangle"], term: "⟨k⟩", def: "Average degree, 2L/N." },
  { tex: ["\\langlek^2\\rangle"], term: "⟨k²⟩", def: "Second moment of the degrees: the average of k². Large when there are hubs; ⟨k²⟩ − ⟨k⟩² is the variance." },
  { tex: ["p_k"], term: "pₖ", def: "Degree distribution: the fraction of nodes with exactly k links." },
  { tex: ["\\gamma"], term: "γ", def: "Degree exponent of a power law pₖ ∝ k^(−γ)." },
  { tex: ["k_\\min", "k_{\\min}", "k_\\text{min}", "k_{\\text{min}}"], term: "k_min", def: "Smallest degree (or the degree from which a power-law tail is fitted)." },
  { tex: ["k_\\max", "k_{\\max}", "k_\\text{max}", "k_{\\text{max}}"], term: "k_max", def: "Largest degree in the network: the biggest hub." },
  { tex: ["L_\\max", "L_{\\max}", "L_\\text{max}", "L_{\\text{max}}"], term: "L_max", def: "Most links N nodes can have: N(N − 1)/2." },
  { tex: ["\\langled\\rangle"], term: "⟨d⟩", def: "Average distance: shortest-path length averaged over all pairs." },
  { tex: ["d_\\max", "d_{\\max}"], term: "d_max", def: "Diameter: the largest distance between two nodes." },
  { tex: ["d_{ij}"], term: "dᵢⱼ", def: "Distance between i and j: links on the shortest path." },
  { tex: ["C_i"], term: "Cᵢ", def: "Clustering coefficient of node i: fraction of its neighbour pairs that are linked." },
  { tex: ["\\langleC\\rangle"], term: "⟨C⟩", def: "Average clustering coefficient over all nodes." },
  { tex: ["C_\\Delta"], term: "C_Δ", def: "Global clustering: 3 × triangles / connected triples." },
  { tex: ["A_{ij}"], term: "Aᵢⱼ", def: "Adjacency-matrix entry: 1 if i and j are linked, else 0." },
  { tex: ["\\kappa"], term: "κ", def: "⟨k²⟩/⟨k⟩: average degree of a node reached by following a random link. Giant component if κ > 2." },
  { tex: ["\\sigma_k"], term: "σₖ", def: "Standard deviation of the degrees: √(⟨k²⟩ − ⟨k⟩²)." },
  { tex: ["\\eta", "\\eta_i"], term: "η", def: "Fitness: a node's intrinsic attractiveness (Bianconi–Barabási model)." },
  { tex: ["\\Pi(k)", "\\Pi(k_i)"], term: "Π(k)", def: "Probability that a new link attaches to a node of degree k." },
  { tex: ["k_{nn}(k)", "k_\\text{nn}(k)", "k_{\\text{nn}}(k)", "k_{nn}"], term: "k_nn(k)", def: "Average degree of the neighbours of degree-k nodes." },
  { tex: ["f_c"], term: "f_c", def: "Critical fraction of removed nodes at which the giant component disappears." },
  { tex: ["T_c"], term: "T_c", def: "Epidemic threshold: the transmissibility above which a large outbreak is possible." },
];
const texKey = (s) => s.replace(/\s+/g, "").replace(/\\(?:,|;|!|:)/g, "");
const SYMBOL_BY_TEX = new Map(SYMBOLS.flatMap((s) => s.tex.map((t) => [texKey(t), s])));

const byLength = () => [...GLOSSARY].sort((a, b) => (b.match || b.term).length - (a.match || a.term).length);
const SKIP = "h1, h2, h3, h4, a, button, code, pre, svg, canvas, .katex, .fig, .callout-label, .chip, .kicker, .quiz-options, .quiz-label, .quiz-feedback, .formula-name, dt, .term, .pager, .site-footer, .beyond-badge, .gloss, table.data, select, label, input, textarea";
const re = (src) => new RegExp(`(?<![\\p{L}\\p{N}_-])(?:${src})(?![\\p{L}\\p{N}_-])`, "iu");

/**
 * Underline the first use of each glossary term inside `root`.
 * `used` carries the terms already marked, so callers can mark per page or per quiz.
 */
export function annotateTerms(root, page, used = new Set(), skip = "") {
  // in Turkish, only entries that have their Turkish fields (t.en is set when they were loaded)
  const terms = byLength().filter((t) => !used.has(t.term) && !(t.skip || []).includes(page) && (LANG !== "tr" || t.en));
  // one named group per term, so a match tells which term it is (look-behinds included)
  const any = re(terms.map((t, i) => `(?<g${i}>${t.match || t.term})`).join("|") || "(?!)");
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue.trim() && !n.parentElement.closest(skip ? `${SKIP}, ${skip}` : SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  // match on each text node's full text, so look-behinds ("hubs bridge", "most connected") see the preceding words
  const all = new RegExp(any.source, "giu");
  for (const node of nodes) {
    const text = node.nodeValue, parts = [];
    let last = 0;
    for (const m of text.matchAll(all)) {
      const t = terms[Number(Object.keys(m.groups).find((g) => m.groups[g] !== undefined).slice(1))];
      if (used.has(t.term)) continue;
      used.add(t.term);
      const span = document.createElement("span");
      span.className = "term";
      span.tabIndex = 0;
      span.dataset.term = t.term;
      span.dataset.def = t.def;
      span.textContent = m[0];
      parts.push(text.slice(last, m.index), span);
      last = m.index + m[0].length;
    }
    if (parts.length) node.replaceWith(...parts, text.slice(last));
  }
  for (const k of root.querySelectorAll(".katex:not(.katex-display .katex)")) {
    if (k.closest(skip ? `.quiz-options, .term, .fig, .formula, ${skip}` : ".quiz-options, .term, .fig, .formula")) continue;
    const src = k.querySelector('annotation[encoding="application/x-tex"]');
    const sym = src && SYMBOL_BY_TEX.get(texKey(src.textContent));
    if (!sym || used.has("sym:" + sym.term) || (sym.skip || []).includes(page)) continue;
    used.add("sym:" + sym.term);
    const span = document.createElement("span");
    span.className = "term sym";
    span.tabIndex = 0;
    span.dataset.term = sym.term;
    span.dataset.def = sym.def;
    k.replaceWith(span);
    span.append(k);
  }
  return used;
}

/** One shared popover for every underlined term: hover or focus shows it, tap toggles it, Escape closes it. */
export function installTermPopover() {
  const pop = document.createElement("div");
  pop.className = "term-pop";
  pop.setAttribute("role", "tooltip");
  pop.hidden = true;
  document.body.append(pop);
  let current = null;
  const show = (el) => {
    current = el;
    pop.innerHTML = "";
    const b = document.createElement("strong");
    b.textContent = el.dataset.term;
    const more = document.createElement("a");
    more.href = "formulas.html#term-" + el.dataset.term.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    more.textContent = "Glossary →";
    pop.append(b, " ", document.createTextNode(el.dataset.def), " ", more);
    pop.hidden = false;
    const r = el.getBoundingClientRect(), w = Math.min(320, window.innerWidth - 24);
    pop.style.width = w + "px";
    const left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2));
    const below = r.bottom + 8 + pop.offsetHeight < window.innerHeight;
    pop.style.left = left + window.scrollX + "px";
    pop.style.top = (below ? r.bottom + 8 : r.top - pop.offsetHeight - 8) + window.scrollY + "px";
  };
  const hide = () => { pop.hidden = true; current = null; };
  document.addEventListener("mouseover", (e) => { const t = e.target.closest?.(".term"); if (t) show(t); });
  document.addEventListener("mouseout", (e) => { const t = e.target.closest?.(".term"); if (t && !pop.contains(e.relatedTarget)) hide(); });
  pop.addEventListener("mouseleave", hide);
  document.addEventListener("focusin", (e) => { if (e.target.classList?.contains("term")) show(e.target); });
  document.addEventListener("focusout", (e) => { if (e.target.classList?.contains("term") && !pop.contains(e.relatedTarget)) hide(); });
  document.addEventListener("click", (e) => {
    const t = e.target.closest?.(".term");
    if (t) { if (current === t && !pop.hidden) hide(); else show(t); return; }
    if (!pop.contains(e.target)) hide();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
  window.addEventListener("scroll", () => { if (!pop.hidden && current) show(current); }, { passive: true });
}
