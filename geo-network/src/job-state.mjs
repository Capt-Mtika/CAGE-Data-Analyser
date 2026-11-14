export const JOB_STATES = Object.freeze([
  'queued', 'validating', 'processing', 'verifying', 'review_required',
  'approved', 'published', 'failed', 'cancelled'
]);

const transitions = Object.freeze({
  queued: ['validating', 'cancelled'],
  validating: ['processing', 'failed', 'cancelled'],
  processing: ['verifying', 'failed', 'cancelled'],
  verifying: ['review_required', 'failed'],
  review_required: ['approved', 'failed'],
  approved: ['published'],
  published: [],
  failed: ['queued'],
  cancelled: []
});

export function mayTransition(current, next) {
  return (transitions[current] ?? []).includes(next);
}

export function transition(job, next, {actor, reason, maxAttempts = 3} = {}) {
  if (!JOB_STATES.includes(job.status)) throw new Error('Unknown current state');
  if (!mayTransition(job.status, next)) throw new Error(`Illegal job transition: ${job.status} → ${next}`);
  if (['approved', 'published'].includes(next) && !actor) throw new Error('Reviewer identity required');
  if (next === 'failed' && !reason) throw new Error('Failure reason required');
  const attempts = (job.attempts ?? 0) + (job.status === 'failed' && next === 'queued' ? 1 : 0);
  if (attempts > maxAttempts) throw new Error('Retry limit reached');
  return {...job, status: next, attempts,
    ...(next === 'failed' ? {error: reason} : {}),
    ...(next === 'approved' ? {approvedBy: actor} : {}),
    ...(next === 'published' ? {publishedBy: actor} : {})
  };
}
