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
  (Art. 39(1)).

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
| `team-ip-confirmation.md` | Long-form, one document covering several people at once — works for contributors (assign) and non-contributors (confirm "none"). |
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

1. Non-contributing teammates → sign `team-ip-confirmation.md` (confirm
   "none" + non-assertion). Real contributors → sign `ip-assignment.md`.
2. Confirm the hackathon organizer's 25%-share position **in writing**
   (see `docs/ip-provenance.md`).
3. Clear any employer claim (get a written statement it is outside scope).
4. Sign your own `authorship-declaration.md`.
5. Copyright needs no registration in Kosovo (Art. 15); optionally lodge a
   dated copy with a notary. Register a **trademark** only if commercialising.
