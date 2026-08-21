# First-Year Terminology Research Report

Built for the "Technical Terms" glossary feature. Scope: **first-year (Semester I & II) only**, Osmania University Faculty of Engineering B.E. curriculum. This is a separate dataset from `shared/terminologyDataset.json` (the pre-existing 346-term, multi-year, multi-branch pre-filter used internally by concept detection) — that dataset is untouched and still in use.

## Final verified count

**339 verified terms.** Not 1500+. See "Why not 1500" below — this is the honest number, not a padded one.

## A note on "OU and OTBI"

The request referenced "OU and OTBI." OTBI (Osmania Technology Business Incubator, shown in ConceptBridge's own footer) is a business incubator affiliated with Osmania University — it does not publish or maintain an academic curriculum, and no such curriculum exists to source terms from. No OTBI-specific terms were fabricated to satisfy this. All 339 terms are sourced from OU's actual Faculty of Engineering first-year academic curriculum.

## Sources actually fetched and used

1. **`https://www.osmania.ac.in/Syllabua2024-2025/Engg/BE-Group%20A%20-I%20Year%20Syllabus.pdf`** and **`BE-Group%20B%20Final%20I%20year%20syllabus.pdf`** — official OU first-year syllabus PDFs, w.e.f. AY 2024-25 (the current "R24" curriculum revision). These confirmed the exact current first-year subject list and course codes for both branch groups, and provided full unit-level content for: Indian Constitution, Environmental Sciences, Essence of Indian Traditional Knowledge, Programming for Problem Solving, Scientific Programming, Engineering Graphics, Engineering Workshop Practice (and their lab courses). The first download attempt (32MB) was truncated by a network timeout; a retry succeeded (40.5MB, verified well-formed with `pdfinfo`/`pdftotext`).
2. **`https://mvsrec.edu.in/images/Mechanical/syllabus/AICTE_MC_2_FULL_SYLLABUS_2020-24_BATCH.pdf`** — a 210-page, OU-affiliated college's mirror of the complete OU Faculty of Engineering AICTE Model Curriculum syllabus (2020-24 batch). This is the primary source for the subjects the two files above don't cover in the Engg board's own document set: Mathematics-I, Mathematics-II, Engineering Physics, Basic Electrical Engineering, Engineering Chemistry, English, and their associated labs. It is an older curriculum revision (2020-24, vs. the current 2024-25 "R24") — see "Naming differences" below for how that was handled honestly.

## Why two source documents, and why the naming differs slightly

OU's Faculty of Engineering board publishes syllabus documents per-subject-group, and the two files fetched directly from `osmania.ac.in` (source 1) only cover the "ES"/"MC" (Engineering Science / Mandatory Course) subjects, not the "BS" (Basic Science) and "HS" (Humanities/Science) subjects like Physics, Chemistry, Math, and English — those are coordinated separately and were not found in an easily crawlable location directly on `osmania.ac.in` during this session. Source 2 fills that gap with a complete, single-document mirror of the same official curriculum family, one revision cycle earlier (2020-24 vs. 2024-25).

The current 2024-25 curriculum (confirmed via source 1) renames two math subjects: what source 2 calls "Mathematics-I" and "Mathematics-II" appear in the current official course list as **"Matrices & Differential Calculus"** and **"Differential Equations & Numerical Methods"** respectively. The subject *content* (confirmed by course code continuity — `BS201MT` and `BS203MT` in both documents) is the same underlying first-year math sequence; the dataset uses the **current, 2024-25 official names** as the subject label, sourcing the actual unit-level term content from the 2020-24 document since that's what was retrievable in detail. This is disclosed here rather than silently presented as if both documents used identical naming.

## Subjects covered (all 17 are real, currently-taught OU first-year subjects — none invented)

| Subject | Semester | Terms |
|---|---|---|
| Engineering Physics | I | 55 |
| Engineering Chemistry | II | 54 |
| Basic Electrical Engineering | I | 38 |
| Programming for Problem Solving | I | 33 |
| Matrices & Differential Calculus | I | 32 |
| Differential Equations & Numerical Methods | II | 28 |
| Environmental Sciences | II | 20 |
| Engineering Graphics | I | 15 |
| Scientific Programming | II | 14 |
| English | II | 11 |
| Engineering Workshop Practice | II | 9 |
| Indian Constitution | I | 9 |
| Engineering Chemistry Lab | II | 6 |
| Engineering Physics Lab | I | 5 |
| Basic Electrical Engineering Lab | I | 4 |
| English Lab | II | 3 |
| Essence of Indian Traditional Knowledge | II | 3 |
| **Total** | | **339** |

By semester: **191 in Semester I, 148 in Semester II.**

## Methodology per term

Every term was manually read directly out of the unit-wise syllabus content of the sources above (not generated from general knowledge first and checked against the syllabus afterward — the syllabus unit text was read first, and terms were extracted from what it actually names). Each entry includes:
- `term` / `normalizedTerm` (lowercased, alphanumeric-only key used for search/dedup)
- `subject`, `semester`
- `importance` (1-10, subject-level weighting — theory courses generally weighted higher than single-credit labs)
- `simpleDefinition` (one sentence, first-year-appropriate but technically accurate)
- `simpleExplanation` (one to two sentences giving context or why it matters)
- `relatedTerms` (auto-populated: other terms in the *same subject* whose definition text cross-references this term, capped at 3 — a deterministic, non-fabricated relation, not an AI guess)
- `source` (the specific document(s) this subject's content was drawn from)

## Terms discovered vs. terms kept (deduplication)

339 terms were extracted and all 339 were kept — the assembly script's automated exact-duplicate check (by normalized term across the whole dataset) found **zero** duplicates, so no terms needed to be discarded for that reason. This is expected: terms were extracted subject-by-subject directly from real content rather than pooled from an oversized candidate list, so accidental duplication was low to begin with by construction, not because deduplication wasn't attempted.

## Questionable / review-list terms

None were kept in the final 339 with unresolved doubt about relevance or accuracy — anything encountered during extraction that felt borderline (e.g. proper nouns from the Indian Constitution and Traditional Knowledge units like specific historical acts or named reform movements, which read more as facts-to-know than "technical terms" in an engineering-glossary sense) was **left out entirely** rather than included provisionally. That's a conservative choice consistent with "don't fabricate/pad" — it's part of why the final count is 339 and not higher.

## Why not 1500+

Restricting strictly to first-year subjects (as required — no pulling in 2nd/3rd/4th-year content to inflate the count) genuinely caps how much true "technical terminology" exists to extract. Several first-year courses are not primarily technical-vocabulary subjects at all: Indian Constitution and Essence of Indian Traditional Knowledge are civics/humanities courses; English and English Lab are language/communication skill courses; Environmental Sciences leans toward civics-adjacent policy content in several units. Even in the STEM-heavy subjects (Physics, Chemistry, Math, BEE, Programming), a first-year syllabus is intentionally introductory — it does not carry the same term density as the advanced electives used to build the *other* (multi-year) dataset in this repo. Reaching 1500 honestly would have required either (a) treating every proper noun, reading-list author, or passing mention in the syllabus as a "term" — which would produce noise, not a useful glossary — or (b) quietly pulling in second-year-and-later content, which was explicitly disallowed. Neither was done. 339 is the number this session could responsibly stand behind as first-year, accurate, and non-redundant.
