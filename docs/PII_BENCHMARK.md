# PII shield benchmarking with Label Studio (dev-side runbook)

The shield's per-entity precision/recall is measured by
`backend/tests/benchmark_pii.py` against a gold-labelled corpus in
`backend/tests/corpus/`. The corpus starts from the synthetic test fixtures;
this runbook grows it with realistically messy documents using
[Label Studio](https://github.com/HumanSignal/label-studio) (Apache 2.0),
run on a **development machine only** — it is a server platform and is never
bundled into the product.

## 1. Run Label Studio

```bash
docker run -it -p 8080:8080 -v $(pwd)/ls-data:/label-studio/data \
  heartexlabs/label-studio:latest
```

Open http://localhost:8080, create a project "LegalBox PII".

## 2. Labeling config

Project Settings → Labeling Interface → paste:

```xml
<View>
  <Labels name="label" toName="text">
    <Label value="PERSON"/>
    <Label value="ORG"/>
    <Label value="NRIC"/>
    <Label value="PASSPORT"/>
    <Label value="PHONE"/>
    <Label value="EMAIL"/>
    <Label value="DOB"/>
    <Label value="CREDIT_CARD"/>
    <Label value="ADDRESS"/>
    <Label value="POSTAL_CODE"/>
    <Label value="UEN"/>
    <Label value="BANK_ACCT"/>
    <Label value="CASE_NO"/>
  </Labels>
  <Text name="text" value="$text"/>
</View>
```

## 3. Corpus sources

- Synthetic documents (like `backend/tests/fixtures/`) — unlimited, safe.
- Public-domain judgments (already public; still label the PII for recall
  measurement).
- Real firm documents **only** with the firm's written permission, labelled
  on the firm's own hardware, and never committed to this repository —
  export scores, not documents.

Label every PII span with the exact category the shield should assign.

## 4. Export → benchmark

Export as JSON (Label Studio's default export), then convert to the
benchmark's simplified format:

```python
# ls-export-convert.py (sketch)
import json, sys
out = []
for task in json.load(open(sys.argv[1])):
    spans = []
    for ann in task["annotations"]:
        for r in ann["result"]:
            v = r["value"]
            spans.append({"start": v["start"], "end": v["end"],
                          "label": v["labels"][0]})
    out.append({"text": task["data"]["text"], "spans": spans})
json.dump(out, open("backend/tests/corpus/labelled_corpus.json", "w"),
          indent=2, ensure_ascii=False)
```

Then run:

```bash
cd backend && ./venv/bin/python tests/benchmark_pii.py
```

## 5. Release gate

Record the per-entity table in the release notes. **A release must not ship
if recall regresses on any entity type** versus the previous release's
table. NER-tier entities (PERSON/ORG) are the ones to watch — regex-tier
entities should stay at 100% recall on the corpus.
