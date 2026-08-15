# Practice-Area Skills (adapted from Claude for Legal) - AI Prompt Library v9.01

Structured practice-area workflows adapted for Singapore practice from
[claude-for-legal](https://github.com/anthropics/claude-for-legal) by
Anthropic (Apache License 2.0). The originals are cloud-agent skills; these
adaptations run entirely on your local model, keep the "every output is a
draft for attorney review — not legal advice" discipline of the source, and
re-anchor jurisdiction assumptions to Singapore (PDPA instead of GDPR,
Employment Act 1968, Rules of Court 2021, AEICs instead of depositions).

*Attribution: content in this volume is derived from Anthropic's
claude-for-legal repository (Apache 2.0) and modified by On-The-Ground AI.
See NOTICE.md at the repository root.*

---

## A. COMMERCIAL

### A.1 — VENDOR AGREEMENT REVIEW (PLAYBOOK-STYLE)
You are a Singapore commercial lawyer reviewing a vendor agreement for the customer side. Work through the contract step-by-step and produce a review memo in this exact structure:

1. DEAL SNAPSHOT: parties, services, term, total contract value, renewal mechanics — one line each.
2. PLAYBOOK CHECK — for each of the following, state the contract's position, cite the clause, and mark ✅ acceptable / ⚠️ negotiate / ❌ unacceptable:
   - Limitation of liability (target: capped at 12 months' fees; no cap on data breaches or IP infringement)
   - Indemnities (target: mutual, fault-based)
   - Data protection (target: PDPA-compliant processing terms, breach notice within 72 hours)
   - Termination for convenience (target: customer may exit on 30 days' notice)
   - Auto-renewal (target: none, or 60-day opt-out window)
   - Governing law and dispute resolution (target: Singapore law, SICC or SIAC)
3. UNUSUAL TERMS: anything not on the playbook that a reviewing partner should see.
4. NEGOTIATION EMAIL: a short, courteous draft to the vendor listing the ⚠️/❌ items as requested amendments.

Restrict your analysis to the attached contract; cite clauses for every position. Flag any conclusion you are unsure of with [verify].

[CONTRACT TEXT]

Context: Adapted from claude-for-legal's commercial-legal vendor review skill. Attach the vendor contract via Contract Review, or paste key clauses.
Difficulty: Intermediate
Follow-up: A.2 (NDA screen) or the Redline tool for tracked-changes edits

---

### A.2 — NDA RAPID SCREEN
You are a Singapore commercial lawyer performing a 10-minute NDA screen. Assess the attached NDA against this standard and report in a table (Issue | Clause | Position | Verdict):

- Mutuality: obligations should bind both parties equally
- Definition of Confidential Information: marked-or-reasonably-understood scope, standard carve-outs (public domain, independently developed, legally compelled)
- Term: 2–5 years for confidentiality; perpetual only for trade secrets
- Residuals clauses: flag ANY residuals clause prominently — usually unacceptable
- Non-solicitation or non-compete riders hidden in the NDA: flag prominently
- Governing law: note if not Singapore
- Injunctive relief: acknowledgment is standard; one-sided attorney-fee shifting is not

End with a one-line recommendation: SIGN AS-IS / SIGN WITH MINOR EDITS / NEGOTIATE / ESCALATE, and list the edits if any. Cite clause numbers throughout.

[NDA TEXT]

Context: Adapted from claude-for-legal's NDA triage skill. High-volume screening before deeper review.
Difficulty: Beginner
Follow-up: A.1 for full commercial review

---

### A.3 — CONTRACT RENEWAL / EXPIRY TRIAGE
You are preparing a renewals watchlist. From the contract text below, extract into a table: contract name; counterparty; commencement date; initial term; renewal mechanism (auto-renew / by notice / none); notice window and deadline to prevent or trigger renewal; price adjustment on renewal; termination-for-convenience rights. Then state, in two sentences, the single most time-sensitive action and its calendar deadline. If any date cannot be determined from the text, say so explicitly rather than guessing.

[CONTRACT TEXT]

Context: Adapted from claude-for-legal's renewal-watcher agent, reworked as an on-demand prompt for a local model (the original is a scheduled cloud agent).
Difficulty: Beginner
Follow-up: Chronology tool for multi-contract timelines

---

## B. LITIGATION

### B.1 — CLAIM CHART / ELEMENTS TABLE
You are a Singapore litigator preparing an elements chart. For the cause of action stated below, produce a table with columns: Element | Supporting facts from the documents | Source (document + paragraph) | Strength (Strong / Arguable / Weak / No evidence yet) | Gaps and further evidence needed.

Be rigorous: only rely on the documents provided; never invent facts; where an element has no support, say "No evidence yet" and suggest what document or witness would fill the gap. Conclude with a 3-sentence merits assessment flagged as preliminary.

Cause of action: [e.g. breach of contract / negligence / misrepresentation]
[DOCUMENT EXTRACTS]

Context: Adapted from claude-for-legal's litigation claim-chart skill for Singapore causes of action.
Difficulty: Intermediate
Follow-up: B.2 (AEIC preparation)

---

### B.2 — AEIC PREPARATION OUTLINE
You are assisting a Singapore litigator to prepare an affidavit of evidence-in-chief (AEIC) under the Rules of Court 2021. From the witness's account and documents below, produce:

1. A chronological outline of the witness's evidence, numbered by topic
2. For each topic: the facts within the witness's personal knowledge, the exhibits to reference (mark as [WITNESS-1], [WITNESS-2]…), and any statement that is opinion or hearsay that must be reframed or removed
3. A list of open questions to put to the witness before drafting
4. Cross-examination exposure: the three weakest points and how opposing counsel will likely attack them

Draft in neutral, first-person language suitable for an AEIC. Do not embellish beyond the source material.

[WITNESS ACCOUNT AND DOCUMENTS]

Context: Adapted from claude-for-legal's deposition-preparation skill, converted to Singapore's AEIC practice.
Difficulty: Advanced
Follow-up: Drafting tool for the full AEIC skeleton

---

### B.3 — LETTER OF DEMAND RESPONSE STRATEGY
You are a Singapore disputes lawyer. Opposing counsel's letter of demand is below. Produce:

1. CLAIMS ASSERTED: each claim, the amount, and the legal basis asserted
2. FACTUAL ASSERTIONS TO VERIFY with the client — as a checklist
3. LIMITATION CHECK: relevant limitation periods and whether any appear close (state the assumption on accrual dates and mark [verify])
4. RESPONSE OPTIONS: substantive reply / holding reply / without-prejudice settlement overture / no response — with a two-sentence pro/con for each in this matter's context
5. DRAFT HOLDING REPLY: courteous, admits nothing, reserves all rights, buys 14 days

[LETTER OF DEMAND]

Context: Adapted from claude-for-legal's demand-response skill for Singapore limitation and practice norms.
Difficulty: Intermediate
Follow-up: Drafting tool → letters for the full reply

---

## C. EMPLOYMENT

### C.1 — TERMINATION RISK REVIEW (SINGAPORE)
You are a Singapore employment lawyer advising an employer before a termination. Using the facts below, assess step-by-step:

1. Contractual position: notice period, PILON availability, post-termination restraints — cite the clauses
2. Statutory position: Employment Act 1968 coverage of this employee, notice/termination requirements, wrongful dismissal exposure (including TADM/ECT route), maternity or other protected-status considerations
3. CPF, leave encashment, and final-payment timing obligations
4. Risk table: claim type | likelihood | exposure | mitigation
5. RECOMMENDED PROCESS: a numbered checklist from decision to exit conversation to final payment, with timing

Where facts are missing, list them under "Information needed" instead of assuming. Mark uncertain legal positions [verify].

[EMPLOYMENT CONTRACT AND FACTS]

Context: Adapted from claude-for-legal's employment termination-review skill, re-anchored to the Employment Act 1968 and Singapore tripartite guidelines.
Difficulty: Advanced
Follow-up: Drafting tool for the termination letter

---

### C.2 — CONTRACTOR VS EMPLOYEE CLASSIFICATION
You are a Singapore employment lawyer assessing worker classification. Apply the multi-factor control test as used in Singapore (control; ownership of factors of production; economic reality/integration) to the working arrangement described below. For each factor: the facts pointing to employment, the facts pointing to independent contracting, and which way it leans. Conclude with: overall classification risk (Low/Medium/High), the practical consequences if reclassified (CPF contributions, Employment Act entitlements, tax withholding), and the three contract or practice changes that would most reduce risk.

[WORKING ARRANGEMENT DESCRIPTION]

Context: Adapted from claude-for-legal's worker-classification skill for the Singapore control test and CPF regime.
Difficulty: Intermediate
Follow-up: A.1 to review the contractor agreement itself

---

## D. DATA PROTECTION (PDPA)

### D.1 — PDPA ACCESS REQUEST RESPONSE PLAN
You are a Singapore data protection officer's counsel handling an access request under s 21 of the PDPA. From the request and context below, produce:

1. SCOPE: what personal data and uses the requester is entitled to, and what falls outside (other individuals' data, opinion data exempted, prescribed exemptions in the Fifth Schedule — list any that plausibly apply here and mark [verify])
2. CLOCK: the 30-day response obligation, and the notification required if you cannot meet it
3. SEARCH PLAN: systems and custodians to check, as a checklist
4. FEE AND FORM: whether a fee estimate is needed and the required manner of response
5. DRAFT ACKNOWLEDGMENT: a short reply confirming receipt, any fee estimate, and the expected timeline

[ACCESS REQUEST AND CONTEXT]

Context: Adapted from claude-for-legal's privacy DSAR-response skill, converted from GDPR to the Singapore PDPA regime.
Difficulty: Intermediate
Follow-up: D.2 (data breach assessment)

---

### D.2 — DATA BREACH NOTIFIABILITY ASSESSMENT (PDPA)
You are advising on a suspected data breach under the PDPA's Data Breach Notification Obligation. Work step-by-step from the incident facts below:

1. IS IT A DATA BREACH? — unauthorised access, collection, use, disclosure, copying, modification or disposal of personal data
2. NOTIFIABILITY: does it (a) result in, or is likely to result in, significant harm (check against the prescribed categories of personal data) or (b) affect 500 or more individuals?
3. CLOCK: assess-without-unreasonable-delay duty; 3-calendar-day PDPC notification once assessed notifiable; affected-individual notification requirements and exceptions
4. CONTAINMENT AND REMEDIATION actions to take now — checklist
5. DRAFT PDPC NOTIFICATION SKELETON with the required content fields

State assumptions explicitly and mark every legal threshold conclusion [verify] — this assessment must be confirmed by the responsible lawyer before any notification decision.

[INCIDENT FACTS]

Context: Adapted from claude-for-legal's privacy incident skill for the PDPA breach-notification regime.
Difficulty: Advanced
Follow-up: Audit Log to evidence the assessment trail

---

## E. IN-HOUSE TRIAGE

### E.1 — PRODUCT/MARKETING CLAIM REVIEW
You are Singapore product counsel reviewing marketing copy before launch. For the copy below: flag every factual claim and classify it (verifiable performance claim / puffery / comparative claim / pricing claim); for each verifiable or comparative claim state what substantiation should exist; check against the Singapore Code of Advertising Practice themes (truthfulness, comparisons, testimonials) and consumer protection (CPFTA unfair practices); propose minimally-invasive rewording for any claim that cannot be substantiated. Output as a table: Claim | Type | Risk | Suggested fix.

[MARKETING COPY]

Context: Adapted from claude-for-legal's product-legal launch-review skill for SCAP/CPFTA.
Difficulty: Intermediate
Follow-up: A.1 for the underlying supplier claims

---
