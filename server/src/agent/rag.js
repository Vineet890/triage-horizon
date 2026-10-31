import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTOCOLS_PATH = path.resolve(__dirname, '../../data/protocols');
const RESULT_LIMIT = 2;
const BM25_K1 = 1.5;
const BM25_B = 0.75;
const STOP_WORDS = new Set([
  'a',
  'about',
  'after',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'but',
  'by',
  'for',
  'from',
  'had',
  'has',
  'have',
  'i',
  'in',
  'is',
  'it',
  'me',
  'my',
  'of',
  'on',
  'or',
  'our',
  'that',
  'the',
  'their',
  'this',
  'to',
  'was',
  'we',
  'were',
  'with',
]);

let indexPromise;

function tokenize(text) {
  return String(text ?? '')
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((term) => term.length > 1 && !STOP_WORDS.has(term)) ?? [];
}

async function loadProtocolIndex() {
  const entries = await fs.readdir(PROTOCOLS_PATH, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.txt'))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (files.length === 0) {
    throw new Error(`No protocol files found in ${PROTOCOLS_PATH}`);
  }

  const documents = [];
  for (const file of files) {
    const text = (
      await fs.readFile(path.join(PROTOCOLS_PATH, file.name), 'utf8')
    ).trim();
    if (!text) throw new Error(`Protocol file is empty: ${file.name}`);

    const terms = tokenize(text);
    const termFrequency = new Map();
    for (const term of terms) {
      termFrequency.set(term, (termFrequency.get(term) ?? 0) + 1);
    }

    documents.push({
      id: path.basename(file.name, '.txt'),
      text,
      length: terms.length,
      termFrequency,
    });
  }

  const documentFrequency = new Map();
  for (const document of documents) {
    for (const term of document.termFrequency.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  return {
    documents,
    documentFrequency,
    averageLength:
      documents.reduce((total, document) => total + document.length, 0) /
      documents.length,
  };
}

function getProtocolIndex() {
  indexPromise ??= loadProtocolIndex().catch((error) => {
    indexPromise = undefined;
    throw error;
  });
  return indexPromise;
}

function scoreDocument(document, queryTerms, index) {
  let score = 0;

  for (const term of queryTerms) {
    const frequency = document.termFrequency.get(term) ?? 0;
    if (frequency === 0) continue;

    const documentFrequency = index.documentFrequency.get(term) ?? 0;
    const inverseDocumentFrequency = Math.log(
      1 +
        (index.documents.length - documentFrequency + 0.5) /
          (documentFrequency + 0.5)
    );
    const lengthNormalization =
      1 -
      BM25_B +
      BM25_B * (document.length / index.averageLength);

    score +=
      inverseDocumentFrequency *
      ((frequency * (BM25_K1 + 1)) /
        (frequency + BM25_K1 * lengthNormalization));
  }

  return score;
}

export async function retrieveProtocols(symptomText) {
  const text = String(symptomText ?? '').trim();
  if (!text) throw new Error('symptomText is required for protocol retrieval');

  const queryTerms = Array.from(new Set(tokenize(text)));
  if (queryTerms.length === 0) {
    throw new Error('symptomText must contain searchable terms');
  }

  const index = await getProtocolIndex();

  return index.documents
    .map((document) => ({
      document,
      score: scoreDocument(document, queryTerms, index),
    }))
    .sort(
      (a, b) =>
        b.score - a.score || a.document.id.localeCompare(b.document.id)
    )
    .slice(0, RESULT_LIMIT)
    .map(({ document, score }) => ({
      text: document.text,
      protocol_id: document.id,
      distance: null,
      retrieval_method: 'local_bm25',
      relevance_score: score,
    }));
}

export default { retrieveProtocols };
