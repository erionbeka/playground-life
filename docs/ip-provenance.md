# IP and Provenance Record

This file documents the authorship and origin of **Playground Life** and the
third-party terms that bear on its ownership. It is an internal record, kept
under version control so the timeline is verifiable. It is not legal advice.

Last updated: 2026-10-16

## 1. Authorship

- Copyright holder: **Erion Beka** (personal).
- The application, its documentation, and assets were created by the
  copyright holder. Contributors are governed by `CONTRIBUTING.md`
  (assignment of rights).

## 2. Build provenance

- The application was built by the copyright holder using the **Lovable**
  AI builder, under the copyright holder's **personal email address**.
- An employer email (`erion.beka@insteap.com`) appears in some repository
  history, but was not the primary account used for creating the work.
  Any contribution made under an employment relationship should be checked
  for work-for-hire ownership before relying on this record.

## 3. Hackathon origin and IP terms

- Origin: the project began as an idea/prototype at the
  **pristina.innovate.healthcare** hackathon, 04–06 April 2025,
  organized by **HealthCare Futurists GmbH**
  (Stadtwaldgürtel 13, 50935 Köln, Germany; managing director Dr. med.
  Tobias D. Gantner).
- Challenge theme: "AI-Powered Interactive Fear-Overcoming Tool for
  Children".
- **What was actually submitted/presented at the event:** only a
  **slide presentation** and a few **small pictures** of how the app might
  look. The **application itself was NOT submitted** to the hackathon, and no
  working code, repository, or build was handed over at the event.
- Timeline note: the hackathon took place 04–06 April **2025**, whereas
  this repository's history begins **April 2026** (first commits by the
  copyright holder). The current application therefore **postdates the
  event by about a year** and was not created as a hackathon submission;
  only the originating **idea** came from the event, and the event output
  was **slides/images only**. This is relevant to the scope of the
  organizer's "solution you create during the event" clause.

Controlling terms, quoted from the organizer's official FAQ
(`https://pristina.innovate.healthcare/faq/`, Q31, accessed 2026-10-16):

> "The solution your team comes up with during the event is owned by the
> team. HealthCare Futurists reserve the right to a 25% share in everything
> that develops based on the hackathon event for those challenges provided
> by HealthCare Futurists. They are ready to join the teams after the event
> and help with strategy, market access, etc. Terms can be discussed.
> Terms concerning sponsor challenges may differ."

Related FAQ entry (Q9):

> "...these challenges will be closed to the public due to IP-specific
> questions. We do not support industry companies turfing their problems
> into our hackathon and then picking their solutions right from within
> without giving back. This might be doable, but not without a further
> contract and clear IP regulations."

The organizer's Privacy page (GDPR/participant data) contains no IP
assignment clause; it is not the IP basis for the work.

### Open item to confirm in writing

The team owns the solution, but the organizer "reserve[s] the right to a
**25% share** in everything that develops based on the hackathon event
**for those challenges provided by HealthCare Futurists**." Confirm with the
organizer:

1. Who provided/owned the "fear-overcoming" challenge (organizer vs.
   sponsor) — "terms concerning sponsor challenges may differ".
2. Whether the 25% share is claimed for this challenge, and on what basis
   (equity, revenue, other).
3. That "terms can be discussed" — obtain any waiver, release, or agreement
   in writing.

Until (1) and (2) are answered in writing, treat the ownership of the work
as **owned by the team, subject to a possible 25% claim by HealthCare
Futurists GmbH**.

## 4. Third-party components

Bundled third-party dependencies are listed in `THIRD_PARTY_NOTICES.md`
(auto-generated). As of 2026-10-16 all are permissive licenses
(MIT, Apache-2.0, ISC, BSD-2-Clause); no copyleft dependencies were found.

## 4a. AI-generated material

Portions of the code and documentation were produced with AI assistance.
In several jurisdictions, material with no human authorship may not be
protected by copyright on its own. Keep human-authored design decisions,
documentation, and selection/arrangement (which are protectable) recorded
alongside the code.

## 4. What protects the rights (beyond this repo)

Files here assert ownership; they do not by themselves create or register
it. Strongest to weakest:

1. **Ownership documents** — assignment/employment agreements, and any
   hackathon organizer waiver.
2. **Copyright registration** in the relevant jurisdiction (enables
   statutory damages/enforcement; ownership is otherwise automatic on
   creation).
3. **Notices** — `LICENSE`, `COPYRIGHT`, `NOTICE`, and source headers.
4. **A dated, signed authorship trail** — git history, this record, signed
   commits, tagged releases.
5. **Trade-secret hygiene** — keep proprietary code and PHI/PII in private,
   access-controlled infrastructure.

## 4a. Evidence practices

- Keep this repo **private**.
- Tag releases (`git tag -s` if signing keys are available) to timestamp
  milestones.
- Keep the dated design/decision docs under `docs/` under version control.
- Regenerate `THIRD_PARTY_NOTICES.md` (`npm run notices`) before any
  distribution.

## 5. Change log

- 2026-10-16: initial record; hackathon FAQ terms captured and quoted.
- 2026-10-16: Kosovo-specific legal templates added under `docs/legal/`,
  citing Law No. 08/L-205 (in force 27 Oct 2023); copyright holder's
  address recorded there.
- 2026-10-16: corrected hackathon facts — the app was **not** submitted to
  the event; only a slide presentation and a few small screenshots were
  presented. The codebase postdates the event by ~1 year.
- 2026-10-16: Albanian (shqip) version of the teammate confirmation
  document added (`team-ip-confirmation-sq.md`/`.pdf`) with a refusal
  record (Annex A).
- 2026-10-16: enhanced both confirmation agreements with a confidentiality
  and third-party-disclosure (incl. AI/cloud services) clause and a
  survival clause; deliberately **no** forfeiture clause (invalid under
  Arts. 7/9/37 and the Law on Obligations). Fixed numbering; regenerated
  PDFs.
- 2026-10-16: issued the **final, hardened** bilingual agreement after
  verifying the Kosovo **Law on Obligations (Law No. 04/L-077)** and the
  **Law on Notary (Law No. 06/L-010)**. Added: a co-author
  waiver/transfer (Art. 9(4)); an explicit broadest-scope transfer that
  defeats the Art. 38(2)/(3) defaults, with an Art. 38(5) anti-ambiguity
  recital; an existing-work-only clause addressing Art. 39(1)/(2)/(3);
  expanded warranties (including employment/commission); a nominal €1
  consideration with Art. 44(2) (no remuneration revision for software);
  indemnity; further assurances; a free-consent and non-reliance clause
  (Arts. 45/46/49 of Law 04/L-077); a no-partnership clause; optional
  notarisation (Art. 43, Law 06/L-010) and apostille; and an **Annex A**
  refusal record in both languages. Restructured both documents to a clean
  1–18 numbering and regenerated both PDFs (9 pages each).
- 2026-10-16: rewrote both documents in a refined, non-confrontational legal
  register. New title: *Agreement on Authorship and Rights in the Work
  "Playground Life"* (*Marrëveshje mbi Autorësinë dhe të Drejtat mbi Veprën
  "Playground Life"*). Removed the "not legal advice" notice block and the
  Annex A refusal record. Reorganised into **17 Articles** with the
  transfer-determinative clauses (authorship, transfer of rights, waiver,
  moral rights, warranties) placed in the **middle**; replaced the blunt
  "declared contribution" signature field with neutral fields (name,
  address, signature, date, optional notarial certification) plus a signed
  acknowledgment paragraph. Both PDFs regenerated (7 pages each).
