#!/usr/bin/env python3
# benchmark_pii.py — per-entity precision/recall for the PII shield.
#
# Reads gold-labelled documents from tests/corpus/*.json and scores the
# shield's detections against them. The corpus format is a simplified
# Label Studio export (see docs/PII_BENCHMARK.md for the labelling
# workflow — Label Studio, Apache 2.0, https://github.com/HumanSignal/label-studio):
#
#   [
#     {"text": "...", "spans": [{"start": 0, "end": 9, "label": "NRIC"}, ...]},
#     ...
#   ]
#
# Usage:  python tests/benchmark_pii.py [corpus_dir]
#
# A detection counts as a hit when it overlaps a gold span of the same label.
# Run this before each release; per-entity recall must not regress.

import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pii_shield  # noqa: E402


def spans_from_shield(text):
    shield = pii_shield.PIIShield()
    collected = pii_shield._resolve_overlaps(shield._collect_spans(text))
    return [(s.start, s.end, s.category) for s in collected]


def overlaps(a_start, a_end, b_start, b_end):
    return a_start < b_end and b_start < a_end


def main():
    corpus_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "corpus"
    docs = []
    for path in sorted(corpus_dir.glob("*.json")):
        docs.extend(json.loads(path.read_text(encoding="utf-8")))
    if not docs:
        print(f"No corpus documents found in {corpus_dir}")
        return 1

    info = pii_shield.engine_info()
    print(f"PII engine: {info['engine']} (NER model: {info['ner_model']})\n")

    tp = defaultdict(int)   # gold spans found (recall numerator)
    fn = defaultdict(int)   # gold spans missed
    fp = defaultdict(int)   # detections with no matching gold span

    for doc in docs:
        text = doc["text"]
        gold = [(s["start"], s["end"], s["label"]) for s in doc["spans"]]
        found = spans_from_shield(text)

        for g_start, g_end, g_label in gold:
            if any(overlaps(g_start, g_end, f_start, f_end) and f_label == g_label
                   for f_start, f_end, f_label in found):
                tp[g_label] += 1
            else:
                fn[g_label] += 1

        for f_start, f_end, f_label in found:
            if not any(overlaps(g_start, g_end, f_start, f_end) and g_label == f_label
                       for g_start, g_end, g_label in gold):
                fp[f_label] += 1

    labels = sorted(set(list(tp) + list(fn) + list(fp)))
    print(f"{'entity':<14} {'gold':>5} {'found':>5} {'precision':>10} {'recall':>8}")
    print("-" * 46)
    total_tp = total_fn = total_fp = 0
    for label in labels:
        gold_n = tp[label] + fn[label]
        found_n = tp[label] + fp[label]
        precision = tp[label] / found_n if found_n else float("nan")
        recall = tp[label] / gold_n if gold_n else float("nan")
        total_tp += tp[label]; total_fn += fn[label]; total_fp += fp[label]
        print(f"{label:<14} {gold_n:>5} {found_n:>5} {precision:>10.2%} {recall:>8.2%}")
    print("-" * 46)
    overall_p = total_tp / (total_tp + total_fp) if total_tp + total_fp else float("nan")
    overall_r = total_tp / (total_tp + total_fn) if total_tp + total_fn else float("nan")
    print(f"{'OVERALL':<14} {total_tp + total_fn:>5} {total_tp + total_fp:>5} "
          f"{overall_p:>10.2%} {overall_r:>8.2%}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
