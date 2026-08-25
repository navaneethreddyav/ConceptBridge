#!/usr/bin/env node
// Hard validation for the Discipline -> Subject -> Unit -> Topic -> Technical Term
// catalogue (shared/firstYearSubjects.json + shared/engineeringTerminology.json).
// Run: node scripts/validateCatalogue.mjs
// Exits non-zero (and prints every specific failure) if any hard requirement below
// is violated. This is the authoritative, code-level version of what
// frontend/src/utils/firstYearSubjects.audit.test.js also checks via vitest — this
// script exists so the exact numeric report can be generated and inspected outside
// a test runner, e.g. before a deploy.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHARED = join(__dirname, '..', 'shared');

const terminology = JSON.parse(readFileSync(join(SHARED, 'engineeringTerminology.json'), 'utf8'));
const catalogue = JSON.parse(readFileSync(join(SHARED, 'firstYearSubjects.json'), 'utf8'));

const MINIMUM_UNIQUE_TERMS = 1500;
const MAJOR_THEORY_MIN_REAL_TERMS = 15; // threshold above which a subject is treated as a "normal substantive theory subject"
const MAJOR_THEORY_MIN_UNITS = 4;

const allTerms = terminology.terms;
const allKeys = new Set(allTerms.map((t) => `${t.term}::${t.subject}`));

const failures = [];
const note = (msg) => failures.push(msg);

// ---- Walk the whole catalogue once, collecting every metric needed ----
let totalUnits = 0;
let totalTopics = 0;
let totalPlacedTerms = 0;
const placedKeysBySubject = new Map(); // subjectId -> [(name, subjectId)]
const subjectsWithZeroTopics = [];
const topicsWithZeroTerms = [];
const unitCountHistogram = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, '6+': 0 };
const majorTheoryFailures = [];
const rows = []; // { discipline, subject, units, topics, terms }

for (const subject of catalogue.subjects) {
    totalUnits += subject.units.length;
    const subjectTopicCount = subject.units.reduce((s, u) => s + u.topics.length, 0);
    totalTopics += subjectTopicCount;

    if (subjectTopicCount === 0) subjectsWithZeroTopics.push(subject.id);

    const placed = [];
    for (const unit of subject.units) {
        if (unit.topics.length === 0) {
            note(`FAIL: ${subject.discipline} -> ${subject.name} -> ${unit.name}: unit has zero topics`);
        }
        for (const topic of unit.topics) {
            if (topic.terms.length === 0) {
                topicsWithZeroTerms.push(`${subject.id}/${unit.id}/${topic.id}`);
                note(`FAIL: ${subject.discipline} -> ${subject.name} -> ${unit.name} -> ${topic.name}: topic has zero terms`);
            }
            for (const name of topic.terms) {
                const resolved = subject.termSubjects.some((ts) => allKeys.has(`${name}::${ts}`));
                if (!resolved) {
                    note(`FAIL: ${subject.discipline} -> ${subject.name}: term "${name}" is orphaned (not found in engineeringTerminology.json under this subject's termSubjects)`);
                }
                placed.push(name);
                totalPlacedTerms += 1;
            }
        }
    }
    placedKeysBySubject.set(subject.id, placed);

    const dupes = placed.filter((t, i) => placed.indexOf(t) !== i);
    if (dupes.length) note(`FAIL: ${subject.discipline} -> ${subject.name}: duplicate term placement within subject: ${[...new Set(dupes)].join(', ')}`);

    const u = subject.units.length;
    if (u >= 6) unitCountHistogram['6+'] += 1;
    else unitCountHistogram[u] = (unitCountHistogram[u] || 0) + 1;

    const realTermCount = allTerms.filter((t) => subject.termSubjects.includes(t.subject)).length;
    if (realTermCount >= MAJOR_THEORY_MIN_REAL_TERMS && u < MAJOR_THEORY_MIN_UNITS) {
        majorTheoryFailures.push(`FAIL: ${subject.discipline} -> ${subject.name} (${realTermCount} real terms) Expected >= ${MAJOR_THEORY_MIN_UNITS} units, Received ${u}`);
    }

    rows.push({ discipline: subject.discipline, subject: subject.name, units: u, topics: subjectTopicCount, terms: placed.length });
}
failures.push(...majorTheoryFailures);

// ---- Global reachability: every real (term, subject) pair must be placed exactly once ----
const resolvedKeys = new Set();
for (const subject of catalogue.subjects) {
    for (const unit of subject.units) {
        for (const topic of unit.topics) {
            for (const name of topic.terms) {
                const match = subject.termSubjects.find((ts) => allKeys.has(`${name}::${ts}`));
                if (match) resolvedKeys.add(`${name}::${match}`);
            }
        }
    }
}
const orphanTerms = [...allKeys].filter((k) => !resolvedKeys.has(k));
for (const k of orphanTerms) note(`FAIL: real term never placed in any subject's catalogue: ${k}`);

// ---- Duplicate canonical terms (exact case-insensitive name collision within one subject) ----
let duplicateCanonicalCount = 0;
const bySubjectSeen = new Map();
for (const t of allTerms) {
    const seen = bySubjectSeen.get(t.subject) || new Set();
    const key = t.term.toLowerCase().trim();
    if (seen.has(key)) {
        duplicateCanonicalCount += 1;
        note(`FAIL: duplicate canonical term "${t.term}" within subject "${t.subject}"`);
    }
    seen.add(key);
    bySubjectSeen.set(t.subject, seen);
}

// ---- Total unique term count ----
if (allTerms.length < MINIMUM_UNIQUE_TERMS) {
    note(`FAIL: UNIQUE TERMS < ${MINIMUM_UNIQUE_TERMS} (found ${allTerms.length})`);
}

// ============================== REPORT ==============================
console.log('DISCIPLINE | SUBJECT | UNITS | TOPICS | TERMS');
for (const r of [...rows].sort((a, b) => a.units - b.units)) {
    console.log(`${r.discipline} | ${r.subject} | ${r.units} | ${r.topics} | ${r.terms}`);
}
console.log('');
console.log(`DISCIPLINES: ${new Set(catalogue.subjects.map((s) => s.discipline)).size}`);
console.log(`SUBJECTS: ${catalogue.subjects.length}`);
console.log(`UNITS: ${totalUnits}`);
console.log(`TOPICS: ${totalTopics}`);
console.log(`RAW TECHNICAL TERMS: ${allTerms.length}`);
console.log(`UNIQUE CANONICAL TECHNICAL TERMS: ${allTerms.length - duplicateCanonicalCount}`);
console.log(`DUPLICATES: ${duplicateCanonicalCount}`);
console.log(`ORPHAN TERMS: ${orphanTerms.length}`);
console.log('');
console.log(`1 UNIT SUBJECTS: ${unitCountHistogram[1] || 0}`);
console.log(`2 UNIT SUBJECTS: ${unitCountHistogram[2] || 0}`);
console.log(`3 UNIT SUBJECTS: ${unitCountHistogram[3] || 0}`);
console.log(`4 UNIT SUBJECTS: ${unitCountHistogram[4] || 0}`);
console.log(`5 UNIT SUBJECTS: ${unitCountHistogram[5] || 0}`);
console.log(`6+ UNIT SUBJECTS: ${unitCountHistogram['6+'] || 0}`);
console.log('');
console.log(`SUBJECTS WITH ZERO TOPICS: ${subjectsWithZeroTopics.length}`);
console.log(`TOPICS WITH ZERO TERMS: ${topicsWithZeroTerms.length}`);
console.log('');

if (failures.length > 0) {
    console.log(`VALIDATION FAILED: ${failures.length} failure(s)`);
    for (const f of failures) console.log(f);
    process.exit(1);
} else {
    console.log('VALIDATION PASSED: 0 failures.');
    process.exit(0);
}
