# Mode: pdf — ATS-optimized CV tailored to one JD

Produce a recruiter-scannable, ATS-parseable PDF CV tailored to a single job
description. Everything on it must be sourced from `cv.md` — tailoring means
*selecting and reframing*, never inventing.

## Required inputs

- **`cv.md`** (repo root) — the candidate's master CV, source of truth.
  Missing → **stop** and tell the user to create it with sections:
  `# Name / contact`, `## Summary`, `## Experience` (company, role, dates,
  bullets), `## Projects`, `## Education`, `## Skills`. Offer to draft it
  interactively from their answers; never fabricate one.
- **A JD**, resolved from `$mode`'s remainder:
  1. pasted text → use directly;
  2. URL → WebFetch it;
  3. company name / keyword → match a `## Pending` entry in
     `data/pipeline.md`, WebFetch its URL;
  4. nothing → ask which pending entry to target.
- `config/profile.yml` (optional) — contact block, language, comp context.

## Workflow

1. **Extract 15–20 JD keywords** (skills, tools, domain nouns, seniority).
2. **Language**: match the JD's language; default English.
3. **Paper**: `letter` for US/Canada roles, else `a4`.
4. **Summary**: rewrite 3–4 lines for this role — target title in sentence
   one, top-5 keywords woven honestly, one quantified proof point from cv.md.
5. **Competencies**: 6–8 short phrases mirroring JD vocabulary that cv.md
   actually supports.
6. **Experience**: reverse-chronological; within each role, reorder bullets
   by JD relevance; reframe wording to exact JD vocabulary when truthful
   (cv.md "LLM workflows with retrieval" + JD "RAG pipelines" → "RAG
   pipeline design"). A JD skill absent from cv.md **never** appears.
7. **Projects**: keep the 3–4 most relevant; drop the section if none.
8. **Six-second gate**: top third of page one must make target role, fit,
   and proof obvious. One page strongly preferred, two max.
9. **Build HTML**: copy `templates/cv-template.html`, replace every
   `data-slot` element's content, delete empty optional sections, leave CSS
   untouched. Write to `output/cv-{name-kebab}-{company-kebab}.html`.
10. **Render**:
    `python agent.py pdf-render output/cv-{…}.html output/cv-{…}-{YYYY-MM-DD}.pdf --format={letter|a4}`
    The helper ATS-normalizes text (smart quotes, dashes, bullets → ASCII)
    and prints via headless Chrome. Non-zero exit → report the error, don't
    improvise another renderer.
11. **Report** (terminal):

    ```
    CV PDF — {company} / {role}
    File: output/cv-…-{date}.pdf ({size}, {pages} page(s))
    Emphasized: {3-5 bullets of what was surfaced/reordered and why}
    Keyword coverage: {matched}/{extracted} — missing: {honest gaps}
    ```

    List gaps honestly — a keyword cv.md can't support is a gap, not a
    rewrite target. Tracker registration: not ported yet; if the JD came
    from `data/pipeline.md`, mention the entry so the user can annotate it.

## ATS rules (non-negotiable)

- Single column; no tables, images, sidebars, headers/footers.
- Standard section names exactly as in the template.
- Selectable text only; no keyword stuffing, no hidden text.
- Keywords distributed: top-5 in summary, first bullet of each role, skills.
- Avoid clichés: "passionate about", "proven track record", "leveraged",
  "spearheaded", "synergies", "robust", "cutting-edge". Prefer specific
  metrics ("cut p95 2.1s → 380ms") and named tools.
