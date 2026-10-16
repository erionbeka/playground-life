# Legal Templates — How to Use

**Not legal advice.** These are starting-point templates. Copyright,
employment and IP-assignment law differ by country. Have a qualified IP
lawyer in your jurisdiction review and adapt them before signing anything.

## Governing law

These templates are calibrated for the **Republic of Kosovo** and cite
**Law No. 08/L-205 on Copyright and Related Rights** (Official Gazette No.
22/2023, 12 October 2023; in force 27 October 2023). That law replaced Law
No. 04/L-065 (2011) and its amendments (Art. 146). Points that matter for
these documents:

- Copyright arises **automatically on creation**; no registration or other
  formality is required (Art. 15).
- The **author is the natural person who created the work** (Art. 7).
- **Moral rights cannot be transferred or licensed** (Art. 22(1)) and are
  protected without limitation in time (Art. 64).
- **Economic rights can be transferred or assigned by written contract**, and
  the assignee becomes the new owner (Art. 37(1)).
- A copyright contract is **valid only in writing** and must state the nature
  and extent of use, the term, the territory and the remuneration (Art. 38).
  If left out, the term defaults to 3 or 5 years and the territory defaults to
  Kosovo only — so always specify them.
- A clause assigning rights in **unidentified future works is invalid**
  (Art. 39(1)); and a licence clause covering **future, unknown uses** is
  likewise invalid, except that a method **already known** at the date of the
  contract, and any method that **evolves from** it, is covered (Art. 39(2)).
- Any **clause contrary to the Law is void**, and the Law applies in its place
  (Art. 39(3)).
- If a term of the transfer is **unclear, the ambiguity is construed in favour
  of the author** (Art. 38(5)) — so the agreement must state the scope
  explicitly, which it does.
- A **co-author may waive the exploitation of his share**, and that share then
  **passes to the other co-author(s)** (Art. 9(4)); the agreement uses this as
  a subsidiary basis in addition to the assignment.
- For **computer programs**, the remuneration and revision rules in Arts.
  40(4), 41, 42 and 43 **do not apply to authors** (Art. 44(2)) — so a
  software contributor cannot later claim extra remuneration.

Supplementary rules come from the **Law on Obligational Relationships (Law No.
04/L-077**, Official Gazette No. 16/2012): freedom of contract (Art. 2); the
duty of **good faith**, which cannot be excluded (Art. 4); and the grounds on
which a contract may be annulled — **threat/duress** (Art. 45), **essential
error** (Art. 46) and **fraud** (Art. 49). A **disproportionate contractual
penalty** ("dënimi kontraktues") can be reduced by the court at the debtor's
request (Art. 258), which is why the agreement avoids punitive forfeiture
clauses. Signatures may optionally be **notarised** under the **Law on Notary
(Law No. 06/L-010**, Official Gazette No. 23/2018); a notarised deed is
directly enforceable (Art. 43).

## Why these documents matter

In Kosovo, ownership follows **who actually created the work**, not who was on
the team. Under Art. 7 the author is the natural person who created it, and
under Art. 9 joint authorship requires a **joint creative effort**. So:

- A person who did **real creative work** owns part of the copyright, and you
  need a **written assignment** from them (Art. 37(1)); and
- A person who did **no creative work** owns **nothing** and has nothing to
  transfer — for them the document simply **records that fact** and removes
  any future argument.

You generally **cannot force** anyone to sign: consent must be free, and a
signature obtained under pressure or by a false statement can be void. If
someone refuses, your position rests on the **facts and evidence** (see
`docs/ip-provenance.md`) — which, when a person truly did nothing, is already
strong.

Two concepts to keep separate:

- **Assignment** = transfer of *ownership*. This is what you want from a
  real contributor.
- **Licence** = permission to use something that someone else still owns.
  That is *not* enough.

## Templates

| File | Use it for |
|---|---|
| `team-ip-confirmation.md` / `.pdf` | **Hardened, sign-ready agreement** (final version) covering **four people** at once — works for contributors (assign) and non-contributors (confirm "none"). Includes fact-confirmation, confirmatory assignment, co-author waiver (Art. 9(4)), moral-rights consent, warranties, confidentiality/AI clause, consideration, indemnity, voluntary-consent recitals and **Annex A** (record of offer and refusal). Optional notarisation. A parallel **Albanian** version is at `team-ip-confirmation-sq.md` / `.pdf`. Print the PDF and have each person fill in their block. |
| `ip-assignment.md` | One contributor, contractor, or anyone who did real work on the code/docs/assets. |
| `authorship-declaration.md` | Your own dated, signed statement of authorship and provenance. |
| `mutual-nda.md` | Before showing the private code to anyone (investors, partners, vendors). |

## How to execute an assignment (practical steps)

1. Fill in every `[BRACKET]` placeholder. Do not leave blanks.
2. Identify the **Assignor** (the contributor) precisely — full legal name
   and address.
3. Sign and **date**. An e-signature is valid in many jurisdictions, but a
   wet-ink original is the safest evidence.
4. **Both parties sign.** An unsigned or one-sided document may be
   unenforceable.
5. Pay the nominal consideration stated (e.g. €1). This is standard and
   helps enforceability.
6. Keep the **signed original** plus a scanned copy under version control
   (e.g. store the scanned PDF in a private folder, not this public doc).
7. Kosovo requires **no registration** for copyright (Art. 15); you may
   optionally lodge a dated copy with a notary to strengthen evidence.

## Can we stop a teammate from feeding the PDF to an AI, or make them lose rights if they do?

**Short answer: a "forfeit your rights if you use AI" clause is not valid or
enforceable, and it is counter-productive. Do not use one.**

Why:

- **No rights to lose.** A teammate who did no creative work owns **nothing**
  (Arts. 7 and 9). A clause stripping "their rights" therefore has no object
  — it is legally meaningless as to them.
- **Ownership passes only by written assignment.** For a real contributor,
  copyright can only move by a written assignment (Art. 37(1)). A
  "forfeiture on conduct" is not an assignment mechanism and would likely be
  **void**.
- **Penalty clause.** A disproportionate penalty for an unrelated act is a
  penalty clause; under the Kosovo Law on Obligations (Law No. 04/L-077) a
  court can reduce or void it, and courts disfavour such traps.
- **It undermines free consent.** The whole document rests on being a
  voluntary, factual record. A punitive trap invites the argument that the
  consent was not free, which could jeopardise the *entire* agreement.
- **It cannot be detected.** There is no reliable way to prove someone used an
  AI tool to read a PDF, so you could never enforce it.

**What actually works** (and is in clause 10 / §10 of the documents): a
**confidentiality clause** that (a) keeps the Agreement and non-public
information about the Work confidential; (b) treats uploading it to an
external AI/cloud/data service as a **disclosure to a third party** requiring
written consent; (c) **carves out** a person's own lawyer, tax adviser, and
legally compelled disclosures, and preserves their rights over their **own
personal data** (Law No. 06/L-082); and (d) makes the remedy **compensation
for proven loss**, expressly **not** forfeiture, so a breach never jeopardises
the assignment itself.

Practical reality: even this clause is hard to enforce if a breach is never
detectable. Its value is partly **deterrent and evidential**. The strongest
protection remains the **facts and evidence** — a non-contributor simply has
no claim to win.

## If a teammate refuses to sign

You cannot compel a signature, and you should not try to. Instead:

1. Keep the **evidence** that you did the work alone — git history, signed
   commits, the Lovable project history, and your dated `authorship-declaration.md`.
2. Make sure the repo **names only you** as author (`AUTHORS`, `COPYRIGHT`,
   `CONTRIBUTING.md`, `docs/ip-provenance.md`). Never list a non-contributor
   as an author or contributor.
3. Ask once, **in writing**, and keep a dated record of the request and any
   refusal (a short email is enough).
4. Offer **non-monetary recognition** (e.g. "hackathon participant") instead
   of framing it as "giving up rights" — most refusals are about that wording.
5. If a real dispute arises, consult a Kosovo IP lawyer; a formal letter or
   mediation usually resolves it, because a non-author has no claim to win.

## Order of operations for this project

1. Non-contributing teammates → sign `team-ip-confirmation.md` (English) or
   its Albanian counterpart `team-ip-confirmation-sq.md`/`.pdf` (confirm
   "none" + non-assertion). Real contributors → sign `ip-assignment.md`.
2. Confirm the hackathon organizer's 25%-share position **in writing**
   (see `docs/ip-provenance.md`).
3. Clear any employer claim (get a written statement it is outside scope).
4. Sign your own `authorship-declaration.md`.
5. Copyright needs no registration in Kosovo (Art. 15); optionally lodge a
   dated copy with a notary. Register a **trademark** only if commercialising.
