import test from 'node:test';
import assert from 'node:assert/strict';

const { buildImmutableRetryRequest } = await import(`../dist/lib/retrySnapshot.mjs?ts=${Date.now()}`);

test('immutable retry preserves stored execution snapshot', () => {
  const request = buildImmutableRetryRequest({
    id: 'run-1',
    agentId: 'agent-a',
    agentVersion: '1.2.3',
    resolvedPrompt: 'ignored because runtime request exists',
    runtimeRequest: {
      prompt: 'frozen prompt',
      agent_id: 'agent-a',
      agent_version: '1.2.3',
      agent_role: 'reviewer',
      agent_capabilities: ['analyze', 'report'],
      run_policy: { timeoutMs: 1234, modelHint: 'frozen-model' },
    },
  });

  assert.deepEqual(request, {
    prompt: 'frozen prompt',
    agent_id: 'agent-a',
    agent_version: '1.2.3',
    agent_role: 'reviewer',
    agent_capabilities: ['analyze', 'report'],
    run_policy: { timeoutMs: 1234, modelHint: 'frozen-model' },
  });
});

test('legacy runs without a stored prompt cannot be retried as immutable replays', () => {
  assert.throws(() => buildImmutableRetryRequest({
    id: 'run-legacy',
    agentId: 'agent-a',
    agentVersion: '1.0.0',
    resolvedPrompt: null,
    runtimeRequest: null,
  }), /Immutable retry unavailable/);
});
