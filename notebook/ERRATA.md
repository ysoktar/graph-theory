# Errata: `Ch2_4_Applied_Tutorial.ipynb`

Every problem found while re-checking the class notebook *From Graphs to Hubs* for the interactive website.
The notebook itself is unchanged; the website presents the corrected versions.

**How it was checked.** All code cells were re-executed on the book's data and their printed outputs compared
with the saved ones; every number was recomputed independently (JavaScript library of this site, NetworkX, igraph,
powerlaw); and every claim was compared with the book's text (networksciencebook.com, Chapters 2–5) and with the
notebook's own results. The book was not trusted either: its claims were re-derived or simulated, and the problems
found in it are listed at the end.

**Locations.** *Cell* counts cells from the top of the notebook (cell 1 is the title). *In [n]* is the execution
count saved with a code cell. The section is the notebook's own heading.

| Severity | Meaning | Count |
|---|---|---|
| Error | a statement or computation that is wrong | 1 |
| Method | a methodological gap or confound that can mislead | 4 |
| Imprecise | true only with a qualification, or overgeneralised | 14 |
| Format | typo or markup | 1 |

## Summary

| # | Severity | Location | Section | Problem |
|---|---|---|---|---|
| [N1](#n1) | Format | cell 1 | Title cell | The bold marker is never closed, so the asterisks show up literally. |
| [N2](#n2) | Imprecise | cell 7 | Part 0 · The data | After symmetrising and removing repeated links, a node's degree is its number of distinct neighbours, not the total degree k_in + k_out: reciprocated links u→v and v→u merge into one. |
| [N3](#n3) | Error | cell 8, In [4] | Part 0 · data loader, powerlaw_degree_sequence() | This is not exact inverse-transform sampling of the discrete power law. |
| [N4](#n4) | Imprecise | cell 13 | I.2 The adjacency matrix | Terminology. |
| [N5](#n5) | Imprecise | cell 21, In [11] | I.5 Paths and distances | 2.7×10⁸ is N(N−1)/2, the number of node pairs, not the number of BFS steps. |
| [N6](#n6) | Imprecise | cell 28 | Part II · introduction | The book (Section 3.2) distinguishes the two definitions: G(N, L), with exactly L random links, is the one Erdős and Rényi used, while G(N, p) “was introduced by Gilbert”. |
| [N7](#n7) | Imprecise | cell 28 | Part II · table of predictions | Above ⟨k⟩ = ln N the random network becomes connected: a single component with no isolated nodes. |
| [N8](#n8) | Method | cell 33, In [17] | II.3 Real networks are not Poisson | This plots the real degree distribution with linear bins on log-log axes, the very plot that III.1 (cell 51) later calls “noise, not physics”: the tail collapses onto the plateau pₖ = 1/N. |
| [N9](#n9) | Imprecise | cell 37 | II.4 Evolution of a random network · Look for | In finite networks the second-largest component peaks near ⟨k⟩ = 1, not exactly at it. |
| [N10](#n10) | Imprecise | cell 41 | II.5 Real networks are supercritical · Look for | ⟨k⟩ < ln N means a random network would most likely not be connected, not that it leaves many nodes out. |
| [N11](#n11) | Method | cell 43 | II.6 Small worlds · Look for | The conclusion is drawn from one network, and it compares the data with the approximate formula ln N/ln⟨k⟩ = 4.81 rather than with a simulated random network (G(N, L): 5.05). |
| [N12](#n12) | Imprecise | cell 47 | II.8 Summary · Discuss | The random network gets the existence of a giant component right, but not its size. |
| [N13](#n13) | Imprecise | cell 48 | Part III · table of results | k_max ∼ ln N holds for an exponential distribution. |
| [N14](#n14) | Method | cell 55, In [28] | III.3 Estimating the degree exponent · real data | This is only step 1 of the CSN method. |
| [N15](#n15) | Imprecise | cell 65, In [34] | III.6 Universality · small multiples | The fitted tail is drawn with the continuous CCDF (k/k_min)^{1−γ}, but the fit is discrete, with CCDF ζ(γ, k)/ζ(γ, k_min). |
| [N16](#n16) | Imprecise | cell 66 | III.6 Universality · Look for | Email's γ̂ = 1.91 ± 0.01 lies inside the anomalous regime γ < 2, which cell 68's table describes as “cannot exist without multi-links”. |
| [N17](#n17) | Method | cell 67, In [35] | III.7 The ultra-small world | With k_min fixed at 2, the average degree changes with γ: the realised ⟨k⟩ is 6.7–8.4 for γ = 2.1 (growing with N), 4.2–4.5 for γ = 2.5 and 2.6 for γ = 3.5, against a single random baseline with ⟨k⟩ = 3. |
| [N18](#n18) | Imprecise | cell 68 | III.8 The role of the degree exponent · table | The notebook's own fits (cell 65) contradict “most real networks”: only 3 of the 8 networks fall in (2, 3) (metabolism 2.71, protein 2.78, WWW 2.16). |
| [N19](#n19) | Imprecise | cell 73 | Part IV · Synthesis table | This holds for the collaboration network (configuration model ⟨C⟩ = 0.0022 against 0.633) but not in general. |
| [N20](#n20) | Imprecise | cell 73 | Part IV · Synthesis table, “measured” column | Both entries generalise beyond the data. σ_k ≫ √⟨k⟩ fails for the power grid (1.79 against 1.63) and is weak for phone calls (2.77 against 1.76). |

## Details

### N1

**Format** · cell 1 · Title cell

> `**Complex Networks: in-class tutorial  …  | Part | Book | Topic | Time |  /  | 0 | — | Setup, data, toolbox`

**Problem.** The bold marker is never closed, so the asterisks show up literally. The overview table declares four columns (Part, Book, Topic, Time), but every row has only three cells, so the Time column is empty. The times appear only in the section headings.

**Correction.** Close the bold (`**Complex Networks: in-class tutorial**`) and either fill in the Time column (5, 25, 35, 45 and 10 min) or drop it.

**Evidence.** Rendered Markdown of cell 1.

### N2

**Imprecise** · cell 7 · Part 0 · The data

> `For directed networks the book reports in- and out-degree exponents separately, so our total-degree values will differ somewhat from Table 4.1.`

**Problem.** After symmetrising and removing repeated links, a node's degree is its number of distinct neighbours, not the total degree k_in + k_out: reciprocated links u→v and v→u merge into one. The link counts drop well below the book's directed values (WWW 1,497,134 → 1,090,108; email 103,731 → 92,442; phone calls 91,826 → 56,853; metabolism 5,802 → 4,741). The average degree is a different quantity too: the book's Table 2.1 lists ⟨k_in⟩ = L/N (4.60 for the WWW), whereas the notebook's ⟨k⟩ = 2L/N (6.69).

**Correction.** Say that the undirected degree counts distinct neighbours, and that L, ⟨k⟩, ⟨k²⟩ and γ for the five directed networks are therefore not comparable with the book's in- and out-degree values.

**Evidence.** Book Table 2.1 versus the counts computed from the book's edge lists (Data page).

**On the website:** [data](https://ysoktar.github.io/graph-theory/data.html)

### N3

**Error** · cell 8 (code, In [4]) · Part 0 · data loader, powerlaw_degree_sequence()

> `# Discrete power-law degrees p_k ~ k^-gamma (k >= kmin) via inverse-transform sampling.`
> `k = np.floor((kmin - 0.5) * (1 - r.random(N)) ** (-1 / (gamma - 1)) + 0.5)`

**Problem.** This is not exact inverse-transform sampling of the discrete power law. It is Clauset et al.'s continuous rounding approximation, which is biased at small k_min. With k_min = 1 and γ = 2.5 it gives P(k = 1) = 0.808 instead of 1/ζ(2.5) = 0.745, and the exact MLE of such a sample is γ̂ = 2.76, not 2.5. With k_min = 2, the value used by the configuration-model figures in cells 67 and 69 (III.7, III.8), P(k = 2) = 0.536 instead of 0.518 and γ̂ = 2.55.

**Correction.** Sample exactly by inversion of P(K ≥ k) = ζ(γ, k)/ζ(γ, k_min), or use powerlaw.Power_Law(...).generate_random(), which the notebook itself uses correctly in cell 54. The approximation is fine for k_min ≳ 6.

**Evidence.** 200,000-draw samples fitted with powerlaw (k_min = 1: γ̂ = 2.759; k_min = 2: 2.552; k_min = 6: 2.507). The same check runs in this site's test suite.

**On the website:** [ch4-generating](https://ysoktar.github.io/graph-theory/ch4-generating.html)

### N4

**Imprecise** · cell 13 · I.2 The adjacency matrix

> `(A²)ᵢⱼ = number of paths of length 2 from i to j, i.e. the number of common neighbours`

**Problem.** Terminology. The notebook follows the book (Box 2.4, whose definition of a path allows repeated nodes), but in standard graph theory a path never revisits a node; what Aⁿ counts are walks. The difference matters as soon as students apply it. On the diagonal, (A²)ᵢᵢ = kᵢ counts the 'paths' i → j → i. For n ≥ 3, (Aⁿ)ᵢⱼ also counts walks that go back and forth, so it is not the number of distinct routes. Only the smallest n with (Aⁿ)ᵢⱼ > 0, the distance, is unaffected. For n = 2 and i ≠ j the notebook's statement is exactly right.

**Correction.** “(Aⁿ)ᵢⱼ = number of walks (node sequences that may repeat) of length n from i to j; for n = 2 and i ≠ j this is the number of common neighbours.”

**Evidence.** Book Box 2.4 and Figure 2.13. The Adjacency page enumerates the walks for any i, j and n.

**On the website:** [ch2-adjacency](https://ysoktar.github.io/graph-theory/ch2-adjacency.html)

### N5

**Imprecise** · cell 21 (code, In [11]) · I.5 Paths and distances

> `# Distances in the collaboration network: exact all-pairs is ~2.7e8 BFS steps, so we sample sources.`

**Problem.** 2.7×10⁸ is N(N−1)/2, the number of node pairs, not the number of BFS steps. An exact all-pairs computation runs N breadth-first searches of cost ≈ N + 2L each, about 4.9×10⁹ elementary steps.

**Correction.** “… exact all-pairs means 2.7×10⁸ node pairs (≈ 5×10⁹ BFS steps), so we sample sources.”

**Evidence.** N = 23,133, L = 93,439: N(N−1)/2 = 2.68×10⁸ and N(N + 2L) = 4.86×10⁹.

**On the website:** [ch2-paths](https://ysoktar.github.io/graph-theory/ch2-paths.html)

### N6

**Imprecise** · cell 28 · Part II · introduction

> `In the Erdős–Rényi model G(N,p), each of the N(N−1)/2 pairs is linked independently with probability p.`

**Problem.** The book (Section 3.2) distinguishes the two definitions: G(N, L), with exactly L random links, is the one Erdős and Rényi used, while G(N, p) “was introduced by Gilbert”. Calling G(N, p) “Erdős–Rényi” is common usage, but it contradicts the book the notebook follows.

**Correction.** “In the random network model G(N, p) (Gilbert; Erdős and Rényi used the closely related G(N, L)) …”

**Evidence.** Book Section 3.2 and Box 3.2.

**On the website:** [ch3-model](https://ysoktar.github.io/graph-theory/ch3-model.html)

### N7

**Imprecise** · cell 28 · Part II · table of predictions

> `| Fully connected | when ⟨k⟩ > ln N | 3.6 |`

**Problem.** Above ⟨k⟩ = ln N the random network becomes connected: a single component with no isolated nodes. “Fully connected” normally means a complete graph, which the book points out happens “only at ⟨k⟩ = N − 1”.

**Correction.** “Connected (a single component) | when ⟨k⟩ > ln N”.

**Evidence.** Book Section 3.6, connected regime.

**On the website:** [ch3-evolution](https://ysoktar.github.io/graph-theory/ch3-evolution.html)

### N8

**Method** · cell 33 (code, In [17]) · II.3 Real networks are not Poisson

> `ks, pk = pk_linear(kc) … ax.loglog(ks, pk, "o", …)`

**Problem.** This plots the real degree distribution with linear bins on log-log axes, the very plot that III.1 (cell 51) later calls “noise, not physics”: the tail collapses onto the plateau pₖ = 1/N. The comparison with the Poisson curve still works, but the figure teaches the habit that Part III warns against.

**Correction.** Use the log-binned pₖ or the CCDF here as well.

**Evidence.** Real-vs-Poisson page, which offers all three views.

**On the website:** [ch3-real-degrees](https://ysoktar.github.io/graph-theory/ch3-real-degrees.html)

### N9

**Imprecise** · cell 37 · II.4 Evolution of a random network · Look for

> `(Right) the 2nd-largest component peaks exactly at the critical point, a finite-size sign of the transition.`

**Problem.** In finite networks the second-largest component peaks near ⟨k⟩ = 1, not exactly at it. The peak sits slightly above 1 and approaches 1 only as N → ∞. With reps = 2 the notebook's own curve is too noisy to locate it precisely.

**Correction.** “… peaks near the critical point ⟨k⟩ = 1 …”

**Evidence.** Union–find simulations averaged over 6–30 runs: the peak is at ⟨k⟩ ≈ 1.10 for N = 10³ and ≈ 1.05 for N = 10⁴ and 10⁵ (grid step 0.025).

**On the website:** [ch3-evolution](https://ysoktar.github.io/graph-theory/ch3-evolution.html)

### N10

**Imprecise** · cell 41 · II.5 Real networks are supercritical · Look for

> `Most also have ⟨k⟩ < ln N, so a random network would leave many nodes outside the giant component.`

**Problem.** ⟨k⟩ < ln N means a random network would most likely not be connected, not that it leaves many nodes out. The expected share outside the giant component is 1 − S(⟨k⟩), with about N·e^{−⟨k⟩} isolated nodes: 0.18% of the nodes (about 340) for the Internet (⟨k⟩ = 6.34), 0.03% (about 7) for collaboration. Only the sparse networks would lose a noticeable share (power grid 8.8%, protein 8.6%).

**Correction.** “… so a random network with the same ⟨k⟩ would not be connected: it would leave a fraction 1 − S of the nodes, small unless ⟨k⟩ is close to 1, outside the giant component.”

**Evidence.** S = 1 − e^{−⟨k⟩S} evaluated for each network (Evolution page, “Real networks are supercritical”).

**On the website:** [ch3-evolution](https://ysoktar.github.io/graph-theory/ch3-evolution.html)

### N11

**Method** · cell 43 · II.6 Small worlds · Look for

> `The real network's ⟨d⟩ is close to the ER estimate, so the random model does well on distances.`

**Problem.** The conclusion is drawn from one network, and it compares the data with the approximate formula ln N/ln⟨k⟩ = 4.81 rather than with a simulated random network (G(N, L): 5.05). Across the eight networks it fails for spatial networks: the power grid has ⟨d⟩ = 18.8 against a random-network value of about 8.5.

**Correction.** Compare each network with its simulated G(N, L) and point out that geographically embedded networks such as the power grid are not small worlds in the random-network sense.

**Evidence.** 300-source distance samples for all eight networks and their G(N, L) counterparts (Small worlds page).

**On the website:** [ch3-small-world](https://ysoktar.github.io/graph-theory/ch3-small-world.html)

### N12

**Imprecise** · cell 47 · II.8 Summary · Discuss

> `Which properties does the random network get **right** (giant component, roughly ⟨d⟩) …`

**Problem.** The random network gets the existence of a giant component right, but not its size. For the collaboration network it predicts N_G/N = 0.9998, while 0.923 is observed: 1,770 scientists sit outside the giant component, where a random network would leave fewer than 10 (theory: 7; simulated G(N, L): 4).

**Correction.** “… right (a giant component exists; ⟨d⟩ roughly) …”

**Evidence.** Cell 46's own table and S(⟨k⟩ = 8.08).

**On the website:** [ch3-summary](https://ysoktar.github.io/graph-theory/ch3-summary.html)

### N13

**Imprecise** · cell 48 · Part III · table of results

> `| Largest hub (natural cutoff) | k_max ≈ k_min N^{1/(γ−1)}; exponential/Poisson: k_max ∼ ln N | 4.3 |`

**Problem.** k_max ∼ ln N holds for an exponential distribution. For a Poisson distribution the book itself (Section 4.3) notes that k_max grows “even slower than the logarithmic dependence”. For Poisson(3), k_max = 10, 11, 13, 14, 16 for N = 10³…10⁷ while ln N goes from 6.9 to 16.1. The same simplification appears in the Part IV table (cell 73): “Largest hub | ∼ ln N”.

**Correction.** “exponential: k_max ≈ k_min + ln N/λ; Poisson: slower still (≈ ln N/ln ln N)”.

**Evidence.** Book Section 4.3; poisson.isf(1/N, 3) (Largest hub page).

**On the website:** [ch4-hubs](https://ysoktar.github.io/graph-theory/ch4-hubs.html)

### N14

**Method** · cell 55 (code, In [28]) · III.3 Estimating the degree exponent · real data

> `The Clauset–Shalizi–Newman recipe chooses the k_min for which the fitted power law is closest to the data (minimum Kolmogorov–Smirnov distance D), and fits γ by MLE on k ≥ k_min.`

**Problem.** This is only step 1 of the CSN method. Step 2, the semi-parametric bootstrap goodness-of-fit test, is missing: a power law is plausible only if p_KS ≥ 0.1. The notebook then argues about “is the Internet scale-free?” using likelihood-ratio tests alone (cell 57). Those only rank candidate distributions, so a power law can beat an exponential and still be implausible. Running the bootstrap on the notebook's own fits rejects the power law for the science collaboration network (the notebook's main example), email and the WWW (all p < 0.001), and narrowly for the Internet (p = 0.064). A caution for anyone adding the test with powerlaw itself: its random generator is wrong for most k_min values (see S1 below), which biases these p-values upwards.

**Correction.** Add the bootstrap goodness-of-fit test before the likelihood-ratio comparisons, and report p next to γ̂ and k_min.

**Evidence.** This site's own bootstrap, 1,000 replicates with the notebook's fits: collaboration, email and WWW p < 0.001 (rejected); Internet p = 0.064 (rejected, borderline); E. coli metabolism 0.106, protein 0.90, phone calls 0.89, power grid 0.76 (not rejected). Validated by a Python cross-check (metabolism 0.113) and calibration tests. The book's Advanced Topic 4.C table points the same way (Internet 0.13, collaboration 0.0001). The Fitting page runs the bootstrap live.

**On the website:** [ch4-fitting](https://ysoktar.github.io/graph-theory/ch4-fitting.html)

### N15

**Imprecise** · cell 65 (code, In [34]) · III.6 Universality · small multiples

> `ax.loglog(tail, (kr >= f.xmin).mean() * (tail / f.xmin) ** (1 - f.power_law.alpha), **THEORY)`

**Problem.** The fitted tail is drawn with the continuous CCDF (k/k_min)^{1−γ}, but the fit is discrete, with CCDF ζ(γ, k)/ζ(γ, k_min). For small k_min the line sits 5–15% too high: email (k_min = 3) +8% at k = 6 and +13% at k = 15; metabolism (k_min = 5) +9–15%; WWW (k_min = 6) +5–8%. For the Internet (k_min = 70) the difference is 1%.

**Correction.** Plot fit.power_law.ccdf() or ζ(γ, k)/ζ(γ, k_min).

**Evidence.** scipy.special.zeta for each fitted network.

**On the website:** [ch4-universality](https://ysoktar.github.io/graph-theory/ch4-universality.html)

### N16

**Imprecise** · cell 66 · III.6 Universality · Look for

> `WWW and email fall at γ̂ ≈ 2, at the edge of the anomalous regime.`

**Problem.** Email's γ̂ = 1.91 ± 0.01 lies inside the anomalous regime γ < 2, which cell 68's table describes as “cannot exist without multi-links”. There is no real contradiction, because that statement concerns the limit N → ∞. A finite network can fit γ < 2 over a limited range (here k ≥ 3, with k_max = 6,553 < N = 57,194), and the undirected projection mixes the book's γ_in = 3.43 and γ_out = 2.03.

**Correction.** “WWW (2.16) is close to 2; email (1.91) even falls below it, possible only because the network is finite …”

**Evidence.** Fits in cell 65; book Table 4.1.

**On the website:** [ch4-universality](https://ysoktar.github.io/graph-theory/ch4-universality.html)

### N17

**Method** · cell 67 (code, In [35]) · III.7 The ultra-small world

> `configuration_graph(powerlaw_degree_sequence(n, g, kmin=2, seed=s), seed=s) … nx.fast_gnp_random_graph(n, 3 / (n - 1), seed=s)`

**Problem.** With k_min fixed at 2, the average degree changes with γ: the realised ⟨k⟩ is 6.7–8.4 for γ = 2.1 (growing with N), 4.2–4.5 for γ = 2.5 and 2.6 for γ = 3.5, against a single random baseline with ⟨k⟩ = 3. Part of the distance reduction that the Look-for box (cell 68) credits to hubs comes simply from the denser networks. The sequences also use the biased sampler of N3.

**Correction.** Compare each power-law network with a random network of the same ⟨k⟩ (or fix ⟨k⟩ by choosing k_min), and sample degrees exactly.

**Evidence.** The notebook's own helpers at N = 10³ and 3×10⁴; the Ultra-small worlds page offers the matched comparison.

**On the website:** [ch4-ultra-small](https://ysoktar.github.io/graph-theory/ch4-ultra-small.html)

### N18

**Imprecise** · cell 68 · III.8 The role of the degree exponent · table

> `| 2<γ<3 (scale-free) | finite | diverges | ln ln N | hubs dominate; most real networks |`

**Problem.** The notebook's own fits (cell 65) contradict “most real networks”: only 3 of the 8 networks fall in (2, 3) (metabolism 2.71, protein 2.78, WWW 2.16). Collaboration (3.43), Internet (3.40), phone calls (4.76) and the power grid (7.6) lie above 3 and email (1.91) below 2. The book says “for many scale-free networks”, and about half of the exponents in its Table 4.1 are in (2, 3).

**Correction.** “many real networks (by the book's directed fits); in our undirected fits, 3 of 8”.

**Evidence.** Cell 65 output; book Section 4.4 and Table 4.1.

**On the website:** [ch4-exponent](https://ysoktar.github.io/graph-theory/ch4-exponent.html)

### N19

**Imprecise** · cell 73 · Part IV · Synthesis table

> `| Clustering | ⟨k⟩/N, flat in k | (configuration model) low: degrees alone create few triangles | high; decreasing C(k) |`

**Problem.** This holds for the collaboration network (configuration model ⟨C⟩ = 0.0022 against 0.633) but not in general. Strongly heterogeneous degree sequences create many triangles among the hubs. With the same degree sequence, the configuration model gives ⟨C⟩ = 0.168 for E. coli metabolism (real 0.377, 45%), 0.0152 for email (real 0.0363, 42%) and 0.0075 for the WWW (real 0.235). Configuration-model clustering scales as C ≈ (⟨k²⟩ − ⟨k⟩)²/(⟨k⟩³N), which is large when ⟨k²⟩ is large.

**Correction.** “low when ⟨k²⟩²/⟨k⟩³ ≪ N; heterogeneous networks get substantial clustering from their degrees alone”.

**Evidence.** Configuration-model counterparts of all eight networks (Generating networks page).

**On the website:** [ch4-generating](https://ysoktar.github.io/graph-theory/ch4-generating.html)

### N20

**Imprecise** · cell 73 · Part IV · Synthesis table, “measured” column

> `| ⟨k²⟩ | … | σ_k ≫ √⟨k⟩ |   …   | Distances | … | small world |`

**Problem.** Both entries generalise beyond the data. σ_k ≫ √⟨k⟩ fails for the power grid (1.79 against 1.63) and is weak for phone calls (2.77 against 1.76). “Small world” fails for the power grid (⟨d⟩ = 18.8; see N11).

**Correction.** Add “except the power grid” to both entries.

**Evidence.** Cell 63 output; distance samples.

**On the website:** [synthesis](https://ysoktar.github.io/graph-theory/synthesis.html)

## Problems found in the book

The book (online edition, networksciencebook.com) was not taken as ground truth either. These are the places where it is
wrong, inconsistent, or does not match its own published data, each backed by a derivation or a count on the data.

| # | Severity | Location | Problem |
|---|---|---|---|
| [B1](#b1) | Error | Chapter 2, Section 2.1 (Königsberg) | No network can have exactly one odd-degree node. |
| [B2](#b2) | Imprecise | Chapter 2, Box 2.4 and Figure 2.13 | The book defines a path loosely, as a sequence of linked nodes in which nodes may repeat. |
| [B3](#b3) | Imprecise | Chapter 2, Table 2.1 (Science collaboration) | The edge list the book distributes (collaboration.edgelist.txt) contains 93,439 distinct undirected links, with no self-loops and no repeated pairs, not 93,437. |
| [B4](#b4) | Imprecise | Chapter 2, Table 2.1 and Chapter 4, Table 4.1 (Protein interactions; Email) | The protein edge list has 2,930 lines, 225 of which are self-loops (a protein binding a copy of itself). |
| [B5](#b5) | Error | Chapter 3, Section 3.5 versus Advanced Topic 3.B | Advanced Topic 3.B computes these two numbers for N = 10⁹, not 7×10⁹, and gets k_max with a largest-term approximation (N·p_k ≈ 1). |

### B1

**Error** · Chapter 2, Section 2.1 (Königsberg)

> `…in 1875 built a new bridge between B and C, increasing the number of links of these two nodes to four. Now only one node was left with an odd number of links.`

**Problem.** No network can have exactly one odd-degree node. The degrees add up to 2L, an even number, so the number of odd-degree nodes is always even (the handshaking lemma). Before the new bridge all four land masses had odd degree (5, 3, 3, 3); raising two of them to 4 leaves two odd nodes, not one. The conclusion, that a walk now exists, is right, and it must run between those two nodes.

**Correction.** “Now only two nodes were left with an odd number of links, so a walk crossing every bridge once exists, from one of them to the other.”

**Evidence.** Σᵢ kᵢ = 2L. Degrees before the new bridge (5, 3, 3, 3), after (5, 4, 4, 3).

**On the website:** [ch2-konigsberg](https://ysoktar.github.io/graph-theory/ch2-konigsberg.html)

### B2

**Imprecise** · Chapter 2, Box 2.4 and Figure 2.13

> `Number of Shortest Parths Between Two Nodes … The number of paths of length d between i and j is N⁽ᵈ⁾ᵢⱼ = (Aᵈ)ᵢⱼ`

**Problem.** The book defines a path loosely, as a sequence of linked nodes in which nodes may repeat. In standard graph theory that is a walk; a path visits each node at most once. (Aᵈ)ᵢⱼ counts walks. It equals the number of shortest paths only when d is the distance dᵢⱼ: a walk of minimal length cannot revisit a node. The box title also has a typo (“Parths”).

**Correction.** “The number of walks of length d is (Aᵈ)ᵢⱼ; for d = dᵢⱼ these are exactly the shortest paths.”

**Evidence.** Karate club: (A⁴)₀,₃₃ counts walks such as 0 → 8 → 0 → 8 → 33, which revisit nodes (Adjacency page).

**On the website:** [ch2-adjacency](https://ysoktar.github.io/graph-theory/ch2-adjacency.html)

### B3

**Imprecise** · Chapter 2, Table 2.1 (Science collaboration)

> `Science Collaboration | Scientists | Co-authorships | Undirected | 23,133 | 93,437 | 8.08`

**Problem.** The edge list the book distributes (collaboration.edgelist.txt) contains 93,439 distinct undirected links, with no self-loops and no repeated pairs, not 93,437. The difference is negligible, but it means the table was not computed from the published file.

**Correction.** L = 93,439 for the published data (⟨k⟩ = 8.08 either way).

**Evidence.** Line count and duplicate check of collaboration.edgelist.txt (tools/preprocess.py).

**On the website:** [data](https://ysoktar.github.io/graph-theory/data.html)

### B4

**Imprecise** · Chapter 2, Table 2.1 and Chapter 4, Table 4.1 (Protein interactions; Email)

> `Protein Interactions | … | 2,018 | 2,930 | 2.90   …   ⟨k²⟩ = 32.3`

**Problem.** The protein edge list has 2,930 lines, 225 of which are self-loops (a protein binding a copy of itself). The book's L, ⟨k⟩ = 2.90 and ⟨k²⟩ = 32.3 count those self-loops as links, while Section 2.3 defines the degree as the number of links to other nodes. As a simple network the values are L = 2,705, ⟨k⟩ = 2.68 and ⟨k²⟩ = 29.4. Likewise, the email network's L = 103,731 includes 648 self-loops (emails to oneself).

**Correction.** State that self-loops are included, or report the simple-network values.

**Evidence.** protein.edgelist.txt: 2,930 lines, 225 with i = j. A degree count with self-loops reproduces the book's ⟨k⟩ = 2.904 and ⟨k²⟩ = 32.27 exactly.

**On the website:** [data](https://ysoktar.github.io/graph-theory/data.html)

### B5

**Error** · Chapter 3, Section 3.5 versus Advanced Topic 3.B

> `…a random society of N ≈ 7 × 10⁹ individuals: the most connected individual … is expected to have k_max = 1,185 acquaintances. The degree of the least connected individual is k_min = 816…`

**Problem.** Advanced Topic 3.B computes these two numbers for N = 10⁹, not 7×10⁹, and gets k_max with a largest-term approximation (N·p_k ≈ 1). For the N ≈ 7×10⁹ of Section 3.5, the book's own definition, at most one node above k_max (N·P(K > k_max) = 1), gives k_max = 1,206 and k_min = 807. With N = 10⁹ the exact tail gives k_max = 1,195. The qualitative point stands: the extremes stay within about ±20% of ⟨k⟩ = 1,000.

**Correction.** Quote k_max ≈ 1,206 and k_min ≈ 807 for N = 7×10⁹ (or say N = 10⁹).

**Evidence.** scipy.stats.poisson.isf(1/N, 1000) and .ppf(1/N, 1000), reproduced live on the Real-networks-are-not-Poisson page.

**On the website:** [ch3-real-degrees](https://ysoktar.github.io/graph-theory/ch3-real-degrees.html)

## Problems found in the software

The notebook relies on the Python package powerlaw (2.0.0). Two defects in its discrete random generators turned up
while cross-checking this site's bootstrap test. They do not affect the notebook's own outputs, but they do affect anyone
who adds the goodness-of-fit test with powerlaw's generator.

| # | Severity | Location | Problem |
|---|---|---|---|
| [S1](#s1) | Error | powerlaw 2.0.0, distributions.py: Distribution._double_search_discrete (used by generate_random for discrete distributions) | The exact discrete random generator bisects a continuous interpolation of the CCDF with tolerance 0.5 inside a bracket [k_min·2^j, k_min·2^(j+1)] and truncates the result. |
| [S2](#s2) | Error | powerlaw 2.0.0, distributions.py: Power_Law._generate_random_discrete_estimate (estimate_discrete=True, the default inside a Fit with x_min ≥ 10) | Clauset et al. |
| [S3](#s3) | Error | powerlaw 2.0.0, distributions.py: Distribution.generate_random with a discrete distribution whose parameters are outside parameter_ranges | parameter_ranges are fitting constraints (default α ∈ [0, 3] since powerlaw 2.0), but they also gate the distribution's own functions. |

### S1

**Error** · powerlaw 2.0.0, distributions.py: Distribution._double_search_discrete (used by generate_random for discrete distributions)

> `x = bisect_map(mn=x1, mx=x2, function=func, target=1-r, tol=0.5)`
> `return int(x)`

**Problem.** The exact discrete random generator bisects a continuous interpolation of the CCDF with tolerance 0.5 inside a bracket [k_min·2^j, k_min·2^(j+1)] and truncates the result. The final bracket lines up with the integers only when k_min is a power of two. For k_min = 3, 5, 6, 10 or 20 the generated CDF is off by 0.017–0.070, and P(k) can even increase with k (α = 2.5, k_min = 5: P(6) = 0.099, P(7) = 0.141; exact 0.164 and 0.111). Any bootstrap built on generate_random() inherits the error: for the E. coli metabolic network it gives p = 0.96 instead of the correct 0.11.

**Correction.** Search over integers: return the largest integer k with ccdf(k) ≥ 1 − r (exponential search, then integer bisection). A tested patch, the reproduction and the validation scripts are in research/powerlaw-discrete-generator/ in the repository.

**Evidence.** Deterministic quantile-grid comparison with the exact CDF across α ∈ {1.8, 2.5} and k_min ∈ {1, …, 20} (α > 3 needs widened parameter_ranges, see S3); exact at k_min = 1, 2, 4, 8, 16. The notebook is not affected: its only call (cell 54) uses k_min = 1, where the generator happens to be exact.

### S2

**Error** · powerlaw 2.0.0, distributions.py: Power_Law._generate_random_discrete_estimate (estimate_discrete=True, the default inside a Fit with x_min ≥ 10)

> `x = (self.xmin - 0.5) * (1 - r) ** (-1/(self.alpha - 1)) + 0.5`
> `return np.around(x)`

**Problem.** Clauset et al. (2009, eq. D.6) floor the shifted value, x = ⌊(x_min − ½)(1 − r)^{−1/(α−1)} + ½⌋. Rounding a value that already includes the +½ pushes samples up by half a unit on average, and P(K = k_min) is roughly halved: 0.074 instead of 0.139 for α = 2.5 and k_min = 10.

**Correction.** Use np.floor.

**Evidence.** 2,000-point quantile grid: P(K = k_min) = 0.0740 / 0.0375 / 0.0150 (powerlaw) against 0.1391 / 0.0722 / 0.0296 (exact) for k_min = 10 / 20 / 50; with floor 0.1395 / 0.0725 / 0.0295.

### S3

**Error** · powerlaw 2.0.0, distributions.py: Distribution.generate_random with a discrete distribution whose parameters are outside parameter_ranges

> `# in Distribution.cdf() and pdf()`
> `if not self.in_range():`
> `    return np.tile(10**sys.float_info.min_10_exp, n)`

**Problem.** parameter_ranges are fitting constraints (default α ∈ [0, 3] since powerlaw 2.0), but they also gate the distribution's own functions. A Power_Law(xmin=…, parameters=[3.5], discrete=True) built by hand is 'out of range', so its cdf and pdf return a constant 10⁻³⁰⁷, its ccdf is 1 for every k, and the search in generate_random() never finds a k with ccdf(k) < 1 − r. The call loops forever without an error.

**Correction.** Either raise an error when in_range() is False, or pass parameter_ranges wide enough to contain the parameters (for example parameter_ranges={'alpha': [1, 10]}) before generating random numbers.

**Evidence.** repro_hang_out_of_range.py: for α = 3.5, k_min = 1, in_range() is False and ccdf(2) = ccdf(100) = 1 (exact: 0.112 and 3.6×10⁻⁶); generate_random(5) is still running when a 20 s timeout kills it. The continuous version, and the discrete one with parameter_ranges={'alpha': [1, 10]}, return immediately.

## Checked and found correct

- Re-executing all 37 code cells on the book's data reproduces every printed number and every table of the saved notebook exactly (only library versions and download messages differ).
- Karate club: N = 34, L = 78, ⟨k⟩ = 4.59, 45 triangles, (A²)₀,₃₃ = 4, diameter 5, ⟨d⟩ = 2.41, 14 shortest paths between 14 and 16, C₀ = 0.150, C₃₃ = 0.110, ⟨C⟩ = 0.571, C_Δ = 0.256 (independently recomputed in JavaScript and in NetworkX).
- Collaboration network: 567 components, giant component 92.3%, ⟨C⟩ = 0.633, C_Δ = 0.264, ⟨d⟩ = 5.35, r = 0.134, k_max = 279, 28 nodes with k ≥ 100.
- Poisson comparisons: k_max ≈ 21, 244 nodes with k ≥ 50 against an expected 6.5×10⁻¹⁹, and 10⁻³⁰⁹ for k ≥ 279.
- All Clauset–Shalizi–Newman fits (k_min, γ̂, σ, tail share) and likelihood-ratio tables. This site's independent JavaScript implementation finds the same k_min for all eight networks and γ̂ within 0.01.
- The powerlaw ≥ 2.0 'gotcha' is real: Power_Law.DEFAULT_PARAMETER_RANGES = {'alpha': [0, 3]}, which gives Internet γ̂ = 2.94 at k_min = 36.
- powerlaw automatically uses the nested likelihood-ratio test for power law against truncated power law, so that row of the table is valid.
- Cell 54 draws its controlled-experiment sample with powerlaw's generate_random at k_min = 1, one of the k_min values where that generator is exact (see S1), so the experiment is valid.
- The closed-form MLE applied with k_min = 1 gives ≈ 2.0 for γ = 2.5 (2.02), as the note in cell 55 says.
- Degree-preserving randomisation with 2L swaps (cell 71) is enough: ⟨C⟩ has already plateaued (0.0022 after 2L swaps, 0.0019–0.0024 after 4L–12L).
- Clustering convention: the book also sets Cᵢ = 0 for kᵢ ≤ 1 (caption of its Figure 2.16), consistent with nx.average_clustering. Using it is a convention, not an error; the Clustering page shows how much it matters.
- Book results used by the notebook, re-derived or simulated rather than trusted: natural cutoff k_max ≈ k_min N^{1/(γ−1)}, divergence of ⟨k²⟩ for γ < 3, ⟨d⟩ ≈ ln N/ln⟨k⟩, S = 1 − e^{−⟨k⟩S}, C = ⟨k⟩/N (simulations on the corresponding pages); Internet γ ≈ 3.4 (our fit 3.40 at k_min = 70, against the book's 3.42 at k_min = 72).

---

Generated by `npm run errata` from `site/js/errata.js`; also published at https://ysoktar.github.io/graph-theory/notebook-check.html.
