#!/usr/bin/env python3
"""Precompute the data files that the website loads.

The website never needs the raw edge lists of the large networks: everything it
plots is derived here, once, with the same conventions as the notebook
(every network is treated as undirected and simple; nodes relabelled 0..N-1).

Usage
-----
    # 1. download the book's data (about 141 MB) and unzip it somewhere
    curl -O https://networksciencebook.com/translations/en/resources/networks.zip
    unzip networks.zip -d raw/
    # 2. run this script (needs numpy, scipy, pandas, networkx, igraph, powerlaw)
    python tools/preprocess.py raw/ --out site/data

Outputs (all small enough to ship with a static site)
-------
    networks.json            per-network summaries, degree histograms, fits, C(k), k_nn(k), ...
    edges/<name>.bin         full edge lists (uint16 pairs) of the six smaller networks
    samples.json             a ~300-node random-walk sample of every network, for drawing
    classic.json             karate club, Southern Women, Florentine families, Les Misérables
    collaboration-extra.json adjacency "spy" data and null-model comparison for the collaboration network
"""
import argparse
import json
import math
import random
import time
import warnings
from pathlib import Path

import igraph as ig
import networkx as nx
import numpy as np
import pandas as pd
import powerlaw
import scipy.sparse as sp
from scipy.sparse.csgraph import connected_components, shortest_path

warnings.filterwarnings("ignore")
SEED = 2026

# name -> (description, category, directed in the original data, ships full edge list)
DATASETS = {
    "metabolic":     ("E. coli metabolism",           "biological",    True,  True),
    "protein":       ("Protein interactions (yeast)", "biological",    False, True),
    "powergrid":     ("US power grid",                "technological", False, True),
    "collaboration": ("Science collaboration",        "social",        False, True),
    "phonecalls":    ("Mobile phone calls",           "social",        True,  True),
    "email":         ("Email",                        "social",        True,  True),
    "internet":      ("Internet (routers)",           "technological", False, False),
    "www":           ("WWW (nd.edu pages)",           "information",   True,  False),
}
PL_KW = {"parameter_ranges": {"alpha": [1, 10]}}   # see the notebook: powerlaw>=2 caps alpha at 3 by default


def r(x, nd=6):
    """Round floats for compact JSON (keeps ints as ints)."""
    if isinstance(x, (int, np.integer)):
        return int(x)
    x = float(x)
    if not math.isfinite(x):
        return None
    return float(f"{x:.{nd}g}")


def load_edges(path):
    # Identical to the notebook's load_edges().
    e = pd.read_csv(path, sep=r"\s+", comment="#", header=None, usecols=[0, 1]).to_numpy(np.int64)
    nodes, e = np.unique(e, return_inverse=True)
    e = e.reshape(-1, 2)
    e = e[e[:, 0] != e[:, 1]]
    e = np.unique(np.sort(e, axis=1), axis=0)
    return e, nodes.size


def csr(e, N):
    A = sp.coo_matrix((np.ones(2 * len(e), dtype=np.int8),
                       (np.r_[e[:, 0], e[:, 1]], np.r_[e[:, 1], e[:, 0]])), shape=(N, N)).tocsr()
    return A


def distance_sample(A, n_sources=300, seed=SEED, batch=20):
    # Same source selection as the notebook's distance_sample().
    _, comp = connected_components(A, directed=False)
    gc_nodes = np.flatnonzero(comp == np.bincount(comp).argmax())
    src = np.random.default_rng(seed).choice(gc_nodes, size=min(n_sources, gc_nodes.size), replace=False)
    counts = np.zeros(1, dtype=np.int64)
    for i in range(0, src.size, batch):
        D = shortest_path(A, method="D", unweighted=True, directed=False, indices=src[i:i + batch])
        d = D[np.isfinite(D) & (D > 0)].astype(np.int64)
        c = np.bincount(d)
        if c.size > counts.size:
            counts = np.pad(counts, (0, c.size - counts.size))
        counts[:c.size] += c
    return counts   # counts[d] = number of (source, target) pairs at distance d


def clustering_stats(g, k):
    C = np.array(g.transitivity_local_undirected(mode="zero"))
    df = pd.DataFrame({"k": k, "C": C})
    ck = df[df.k > 1].groupby("k").C.agg(["mean", "size"])
    return C, {"k": ck.index.tolist(), "C": [r(v, 5) for v in ck["mean"]], "n": ck["size"].tolist()}


def knn_stats(A, k):
    with np.errstate(divide="ignore", invalid="ignore"):
        knn_i = (A @ k.astype(np.float64)) / k
    df = pd.DataFrame({"k": k, "knn": knn_i})
    g = df[df.k > 0].groupby("k").knn.mean()
    return {"k": g.index.tolist(), "knn": [r(v, 5) for v in g.values]}


def describe(e, N, n_sources=200):
    """The notebook's describe(), on an edge array."""
    k = np.bincount(e.ravel(), minlength=N)
    A = csr(e, N)
    g = ig.Graph(n=int(N), edges=e.tolist())
    _, comp = connected_components(A, directed=False)
    dc = distance_sample(A, n_sources)
    C = np.array(g.transitivity_local_undirected(mode="zero"))
    return {"N": int(N), "L": int(len(e)), "avgk": r(k.mean()), "k2": r((k ** 2).mean()), "kmax": int(k.max()),
            "giant": r(np.bincount(comp).max() / N), "avgd": r((np.arange(dc.size) * dc).sum() / dc.sum()),
            "C": r(C.mean()), "transitivity": r(g.transitivity_undirected()),
            "r": r(g.assortativity_degree(directed=False))}, C, k


def configuration_edges(k, seed):
    # Notebook's configuration_graph(): pair shuffled stubs, drop self-loops and multi-links.
    stubs = np.repeat(np.arange(len(k)), k)
    np.random.default_rng(seed).shuffle(stubs)
    e = stubs[: stubs.size - stubs.size % 2].reshape(-1, 2)
    e = e[e[:, 0] != e[:, 1]]
    return np.unique(np.sort(e, axis=1), axis=0)


def gnm_edges(N, L, seed):
    random.seed(seed)
    ig.set_random_number_generator(random)
    g = ig.Graph.Erdos_Renyi(n=N, m=int(L))
    return np.array(g.get_edgelist(), dtype=np.int64).reshape(-1, 2)


def powerlaw_fit(k):
    kk = k[k > 0]
    f = powerlaw.Fit(kk, discrete=True, verbose=False, **PL_KW)
    xmin = int(f.xmin)
    tail = kk[kk >= xmin]
    out = {"kmin": xmin, "gamma": r(f.power_law.alpha), "sigma": r(f.power_law.standard_err), "D": r(f.power_law.D),
           "ntail": int(tail.size), "tailShare": r(tail.size / k.size)}
    comps = {}
    for alt in ["exponential", "lognormal", "truncated_power_law", "stretched_exponential"]:
        R, p = f.distribution_compare("power_law", alt, normalized_ratio=True)
        comps[alt] = {"R": r(R), "p": r(p)}
    out["compare"] = comps
    out["params"] = {"exponential": {"lambda": r(f.exponential.Lambda)},
                     "lognormal": {"mu": r(f.lognormal.mu), "sigma": r(f.lognormal.sigma)},
                     "truncated_power_law": {"alpha": r(f.truncated_power_law.alpha),
                                             "lambda": r(f.truncated_power_law.Lambda)}}
    # CCDF curves P(K >= x | K >= kmin) of the data and of each fitted distribution, at the tail's unique values
    xu = np.unique(tail)
    data_ccdf = np.array([(tail >= x).mean() for x in xu])
    curves = {"x": xu.tolist(), "data": [r(v, 5) for v in data_ccdf]}
    for name in ["power_law", "exponential", "lognormal", "truncated_power_law"]:
        dist = getattr(f, name)
        curves[name] = [r(v, 5) for v in dist.ccdf(data=xu)]
    out["curves"] = curves
    # The software gotcha: powerlaw's default parameter range (alpha <= 3)
    f0 = powerlaw.Fit(kk, discrete=True, verbose=False)
    out["defaultRange"] = {"kmin": int(f0.xmin), "gamma": r(f0.power_law.alpha)}
    return out


def kmin_scan(k, n=80):
    kk = k[k > 0]
    rows = []
    for km in np.unique(kk)[:n]:
        f = powerlaw.Fit(kk, discrete=True, verbose=False, xmin=km, **PL_KW)
        rows.append((int(km), r(f.power_law.D), r(f.power_law.alpha)))
    return {"kmin": [a for a, _, _ in rows], "D": [b for _, b, _ in rows], "gamma": [c for _, _, c in rows]}


def random_walk_sample(A, k, size, seed, restart=0.15):
    """Random walk with restarts from a random node of the giant component; returns the induced subgraph."""
    rng = np.random.default_rng(seed)
    _, comp = connected_components(A, directed=False)
    gc = np.flatnonzero(comp == np.bincount(comp).argmax())
    start = cur = int(rng.choice(gc))
    seen = {cur}
    order = [cur]
    indptr, indices = A.indptr, A.indices
    steps = 0
    while len(order) < size and steps < 200 * size:
        steps += 1
        if rng.random() < restart:
            cur = start
            continue
        nb = indices[indptr[cur]:indptr[cur + 1]]
        cur = int(nb[rng.integers(nb.size)])
        if cur not in seen:
            seen.add(cur)
            order.append(cur)
    nodes = np.array(order)
    sub = A[nodes][:, nodes].tocoo()
    m = sub.row < sub.col
    edges = np.c_[sub.row[m], sub.col[m]]
    # keep the largest connected piece (it always contains the start node's walk, so it is ~all nodes)
    G = nx.Graph()
    G.add_nodes_from(range(nodes.size))
    G.add_edges_from(edges.tolist())
    keep = sorted(max(nx.connected_components(G), key=len))
    relabel = {v: i for i, v in enumerate(keep)}
    edges = [[relabel[u], relabel[v]] for u, v in edges.tolist() if u in relabel and v in relabel]
    return {"n": len(keep), "edges": edges, "degree": [int(k[nodes[v]]) for v in keep]}


def analyse(name, path, out_dir):
    desc, category, directed, ship = DATASETS[name]
    t0 = time.time()
    e, N = load_edges(path)
    L = len(e)
    k = np.bincount(e.ravel(), minlength=N)
    A = csr(e, N)
    g = ig.Graph(n=int(N), edges=e.tolist())
    ks, cnt = np.unique(k, return_counts=True)

    comps = np.array(g.connected_components().sizes())
    s_vals, s_cnt = np.unique(comps, return_counts=True)
    C, ck = clustering_stats(g, k)
    dc = distance_sample(A, 300)

    res = {
        "name": name, "description": desc, "category": category, "originallyDirected": directed,
        "edgeFile": f"edges/{name}.bin" if ship else None,
        "N": int(N), "L": int(L), "avgk": r(k.mean()), "k2": r((k ** 2).mean()), "sigmak": r(k.std()),
        "kmax": int(k.max()), "kmedian": r(np.median(k)), "kmin": int(k.min()),
        "degreeHist": {"k": ks.tolist(), "count": cnt.tolist()},
        "components": {"count": int(comps.size), "giant": int(comps.max()), "giantFraction": r(comps.max() / N),
                       "sizes": s_vals.tolist(), "sizeCount": s_cnt.tolist()},
        "clustering": {"avg": r(C.mean()), "transitivity": r(g.transitivity_undirected()), "byDegree": ck},
        "distances": {"sources": 300, "count": dc.tolist(), "avg": r((np.arange(dc.size) * dc).sum() / dc.sum()),
                      "maxObserved": int(dc.size - 1)},
        "assortativity": r(g.assortativity_degree(directed=False)),
        "knn": knn_stats(A, k),
    }
    print(f"  [{name}] basics {time.time() - t0:.0f}s", flush=True)
    res["powerlaw"] = powerlaw_fit(k)
    print(f"  [{name}] power-law fit {time.time() - t0:.0f}s  kmin={res['powerlaw']['kmin']} "
          f"gamma={res['powerlaw']['gamma']}", flush=True)

    # Null models with the same N and L (ER) or the same degree sequence (configuration model)
    er, C_er, k_er = describe(gnm_edges(N, L, SEED), N)
    cm_e = configuration_edges(k, SEED)
    cm, C_cm, k_cm = describe(cm_e, N)
    res["nullModels"] = {"er": er, "configuration": cm}
    print(f"  [{name}] null models {time.time() - t0:.0f}s", flush=True)

    if ship:
        (out_dir / "edges").mkdir(parents=True, exist_ok=True)
        e.astype("<u2").tofile(out_dir / "edges" / f"{name}.bin")
    sample = random_walk_sample(A, k, 300, SEED)
    return res, sample, (e, N, k, C, g)


def classic():
    out = {}
    K = nx.karate_club_graph()
    out["karate"] = {
        "description": "Zachary's karate club (1977): 34 members, links = interaction outside the club",
        "nodes": [{"id": v, "club": K.nodes[v]["club"]} for v in K],
        "edges": [[u, v, K[u][v].get("weight", 1)] for u, v in K.edges()],
    }
    B = nx.davis_southern_women_graph()
    women, events = B.graph["top"], B.graph["bottom"]
    out["southernWomen"] = {
        "description": "Davis, Gardner & Gardner (1941): 18 women and the 14 social events they attended",
        "women": women, "events": events,
        "edges": [[women.index(u), events.index(v)] if u in women else [women.index(v), events.index(u)]
                  for u, v in B.edges()],
    }
    F = nx.florentine_families_graph()
    fn = sorted(F)
    out["florentine"] = {
        "description": "Marriage ties among Renaissance Florentine families (Padgett & Ansell 1993)",
        "names": fn, "edges": [[fn.index(u), fn.index(v)] for u, v in F.edges()],
    }
    M = nx.les_miserables_graph()
    mn = sorted(M)
    out["lesmis"] = {
        "description": "Co-appearance of characters in Victor Hugo's Les Misérables (Knuth 1993)",
        "names": mn, "edges": [[mn.index(u), mn.index(v), M[u][v]["weight"]] for u, v in M.edges()],
    }
    return out


def collaboration_extra(e, N, k, C_real):
    out = {}
    A = csr(e, N)
    # Zoom on the first 1,000 x 1,000 block (exact non-zeros) and a binned image of the whole matrix
    m = (e[:, 0] < 1000) & (e[:, 1] < 1000)
    out["block"] = {"size": 1000, "edges": e[m].tolist()}
    B = 200
    bi = (np.r_[e[:, 0], e[:, 1]] * B // N)
    bj = (np.r_[e[:, 1], e[:, 0]] * B // N)
    img = np.zeros((B, B), dtype=np.int64)
    np.add.at(img, (bi, bj), 1)
    out["image"] = {"bins": B, "counts": img.ravel().tolist()}

    # The notebook's null-model comparison (Section III.9) with C(k) for each network
    rows = {}
    real, C_r, _ = describe(e, N)
    rows["real"] = real
    t0 = time.time()
    G = nx.Graph()
    G.add_nodes_from(range(N))
    G.add_edges_from(e.tolist())
    G_dpr = G.copy()
    nx.double_edge_swap(G_dpr, nswap=2 * G.number_of_edges(), max_tries=10 ** 7, seed=SEED)
    e_dpr = np.array([(min(u, v), max(u, v)) for u, v in G_dpr.edges()], dtype=np.int64)
    rows["degreePreserving"], C_dpr, k_dpr = describe(e_dpr, N)
    print(f"  [collaboration] degree-preserving randomisation {time.time() - t0:.0f}s", flush=True)
    rows["configuration"], C_cm, k_cm = describe(configuration_edges(k, SEED), N)
    rows["er"], C_er, k_er = describe(gnm_edges(N, len(e), SEED), N)
    out["comparison"] = rows

    def ck(C, kk):
        df = pd.DataFrame({"k": kk, "C": C})
        g = df[df.k > 1].groupby("k").C.mean()
        return {"k": g.index.tolist(), "C": [r(v, 5) for v in g.values]}
    out["Ck"] = {"real": ck(C_r, k), "degreePreserving": ck(C_dpr, k_dpr), "er": ck(C_er, k_er)}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("raw", type=Path, help="folder holding <name>.edgelist.txt")
    ap.add_argument("--out", type=Path, default=Path("site/data"))
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    networks, samples = {}, {}
    collab = None
    for name in DATASETS:
        print(f"{name} ...", flush=True)
        res, sample, extra = analyse(name, args.raw / f"{name}.edgelist.txt", args.out)
        if name == "internet":
            res["powerlaw"]["scan"] = kmin_scan(extra[2])
        networks[name] = res
        samples[name] = sample
        if name == "collaboration":
            collab = extra

    meta = {"source": "A.-L. Barabási, Network Science (networksciencebook.com), Table 4.1 reference networks",
            "url": "https://networksciencebook.com/translations/en/resources/networks.zip",
            "conventions": "undirected, simple (self-loops and repeated links removed), nodes relabelled 0..N-1",
            "seed": SEED, "distanceSources": 300, "powerlawVersion": powerlaw.__version__}
    dump(args.out / "networks.json", {"meta": meta, "networks": networks})
    dump(args.out / "samples.json", samples)
    dump(args.out / "classic.json", classic())
    e, N, k, C, _ = collab
    dump(args.out / "collaboration-extra.json", collaboration_extra(e, N, k, C))


def dump(path, obj):
    path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False))
    print(f"wrote {path} ({path.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
