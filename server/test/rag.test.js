import assert from 'node:assert/strict';
import test from 'node:test';
import { retrieveProtocols } from '../src/agent/rag.js';

test('retrieves the cardiac protocol for chest pain symptoms', async () => {
  const results = await retrieveProtocols('crushing chest pain with sweating');

  assert.equal(results[0].protocol_id, 'CARD-001');
  assert.equal(results[0].retrieval_method, 'local_bm25');
  assert.ok(results[0].relevance_score > 0);
});

test('retrieves the neurology protocol for stroke warning symptoms', async () => {
  const results = await retrieveProtocols(
    'facial droop and slurred speech with arm weakness'
  );

  assert.equal(results[0].protocol_id, 'NEURO-001');
});

test('returns distinct protocols and rejects empty symptom text', async () => {
  const results = await retrieveProtocols('chest pain');

  assert.equal(results.length, 2);
  assert.equal(new Set(results.map((result) => result.protocol_id)).size, 2);
  await assert.rejects(retrieveProtocols('   '), /symptomText is required/);
});
