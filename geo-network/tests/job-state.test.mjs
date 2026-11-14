import test from 'node:test';
import assert from 'node:assert/strict';
import {JOB_STATES, mayTransition, transition} from '../src/job-state.mjs';

test('valid processing route requires manual review before publication', () => {
  let job = {status: 'queued', attempts: 0};
  for (const status of ['validating', 'processing', 'verifying', 'review_required']) job = transition(job, status);
  assert.throws(() => transition(job, 'published', {actor: 'reviewer'}), /Illegal/);
  job = transition(job, 'approved', {actor: 'reviewer'});
  job = transition(job, 'published', {actor: 'publisher'});
  assert.equal(job.status, 'published');
  assert.equal(job.approvedBy, 'reviewer');
});

test('failures require explanation and retry limit is enforced', () => {
  assert.throws(() => transition({status:'processing'}, 'failed'), /reason/);
  let job = {status: 'failed', attempts: 3};
  assert.throws(() => transition(job, 'queued'), /limit/);
  assert.equal(transition({status: 'failed', attempts: 1}, 'queued').attempts, 2);
});

test('terminal and out-of-order states are blocked', () => {
  assert.equal(mayTransition('published', 'processing'), false);
  assert.equal(mayTransition('cancelled', 'queued'), false);
  assert.throws(() => transition({status:'queued'}, 'approved'), /Illegal/);
  assert.throws(() => transition({status:'nonsense'}, 'queued'), /Unknown/);
  assert.deepEqual(new Set(JOB_STATES).size, JOB_STATES.length);
});
