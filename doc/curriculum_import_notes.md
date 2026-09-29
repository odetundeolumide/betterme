# Curriculum import notes (STEP 2)

Ambiguities in `doc/WAEC_Subjects_and_Curriculum.md` and the decisions taken.
Nothing below was guessed into the data — open items need a human decision.

## Naming decisions (recorded, not guessed)
- Doc says "Health Education / Health Science" → stored as **Health Science**
  (`health-science`), the WAEC subject name.
- Doc says "History (Nigerian History)" → stored as **History** (`history`).
- Doc says "Agriculture (Agricultural Science)" → **Agricultural Science**.
- Doc says "Islamic Studies (Islamic Religious Studies)" →
  **Islamic Religious Studies**.
- "Visual Art" kept singular as written.

## Parser rules (no content invented or rewritten)
- Topic titles/notes are copied verbatim from the document.
- `(*)` / `(**)` / trailing `*` markers move into topic `notes`, with the
  meaning taken from each subject's own legend line (e.g. General Maths and
  Further Maths "tested in Section B of Paper 2 only"; Further Maths
  "(**) peculiar to Nigeria"; Marketing "* stresses practical work").
- Plain numbered items without bold (`Physics`, `Geography`) split into
  title/notes on the first `;` when the head is under 100 chars.
- Bold `**A.**` / `**Part N**` / `**Section X**` / `**Paper N**` lines become
  parent sections; italic `*Section X*` lines nest under them.
- Same-indent bullets are siblings (indent stack), deeper bullets are children.
- Literature-in-English has **zero topics**: the section only lists set texts
  (kept verbatim in subject notes) plus study lenses. OPEN: decide how to
  model set texts (topics per text? per category?) before students track it.

## Deliberately kept as text, not structure
- CRS/Islamic "may not be taken together" rules → subject notes (not enforced).
- "Citizenship and Heritage Studies replaces Civic Education from 2028" → notes.
- Technical Drawing "Vector Geometry (Ghana only)" section → imported with
  "(Ghana only)" in its title so it is visible, not silently dropped.
- Omitted per instructions (never added): Arabic, Yoruba, Igbo, Hausa,
  trade/vocational subjects, Digital Technologies, Citizenship and Heritage.

## Source reliability
- Every subject row in `curriculum_sources` records URL + note + edition.
- Almost all sources are secondary copies (studentship.com.ng,
  rachel.core2learn.org); `reliability='secondary-copy-unverified'` and
  `last_verified_at=NULL` everywhere until checked against official syllabi.
- The app shows "Source: <note>. Confirm against your school's syllabus."

## Re-import safety
- Topics load only into subjects with zero topics; re-runs SKIP the rest so
  admin corrections survive. Use `--force` (or `--subject=<slug> --force`)
  to replace a tree deliberately.
- Papers/textbooks/sources refresh every run (no admin-owned columns there),
  except `last_verified_at`, which is never overwritten by import.
- Dept links use INSERT … ON CONFLICT DO NOTHING; eligibility flags edited
  by an admin are preserved. The Economics default note applies once.

## API trust model (same as the rest of this repo)
- The client passes `user_id` (Better Auth id); writes verify the user exists
  in the `user` table and that URL/body ids match. There is no
  session-cookie check on these endpoints — identical to `/api/attempts`.
- Admin endpoints require the id in `admin_users` (seed manually).
