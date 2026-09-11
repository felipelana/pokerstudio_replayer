import { describe, expect, it } from 'vitest';
import {
  REDACTED,
  normaliseRoute,
  recordError,
  redact,
} from '../../src/server/application/observability/RecordError.js';
import { fakeErrors } from './fakes.js';

describe('redaction', () => {
  it('drops anything whose name says it is a credential', () => {
    const out = redact({
      email: 'player@example.com',
      password: 'a-strong-passphrase',
      sessionToken: 'ps_abcdef',
      headers: { cookie: 'ps_session=xyz', accept: 'application/json' },
    }) as Record<string, unknown>;

    expect(out.email).toBe('player@example.com');
    expect(out.password).toBe(REDACTED);
    expect(out.sessionToken).toBe(REDACTED);
    expect((out.headers as Record<string, unknown>).cookie).toBe(REDACTED);
    expect((out.headers as Record<string, unknown>).accept).toBe('application/json');
  });

  it('will not store an unbounded string', () => {
    const out = redact({ note: 'x'.repeat(5_000) }) as { note: string };
    expect(out.note.length).toBeLessThan(600);
  });

  it('stops descending before a cycle can become a stack overflow', () => {
    const deep = { a: { b: { c: { d: { e: 'buried' } } } } };
    expect(JSON.stringify(redact(deep))).toContain('[deep]');
  });
});

describe('route normalisation', () => {
  it('turns the ids of one request into the shape of many', () => {
    expect(
      normaliseRoute('get', '/api/v1/reviews/3f2504e0-4f89-11d3-9a0c-0305e82c3301/hands/1204?x=1'),
    ).toBe('GET /api/v1/reviews/:id/hands/:id');
  });

  it('keeps a plain route as it is', () => {
    expect(normaliseRoute('POST', '/api/v1/auth/login')).toBe('POST /api/v1/auth/login');
  });
});

describe('recordError', () => {
  it('stamps the environment and the release on every row', async () => {
    const errors = fakeErrors();
    await recordError(
      { errors, env: 'staging', release: '1.2.3' },
      { source: 'SERVER', message: 'boom' },
    );

    expect(errors.entries).toHaveLength(1);
    expect(errors.entries[0]).toMatchObject({
      env: 'staging',
      release: '1.2.3',
      level: 'ERROR',
      message: 'boom',
    });
  });

  it('never throws when the store itself is broken', async () => {
    const broken = {
      ...fakeErrors(),
      record: async () => {
        throw new Error('database is down');
      },
    };
    let reported: unknown;

    await expect(
      recordError(
        { errors: broken, env: 'production', onFailure: (e) => (reported = e) },
        { source: 'CLIENT', message: 'x' },
      ),
    ).resolves.toBeUndefined();
    expect(reported).toBeInstanceOf(Error);
  });

  it('redacts the context on the way in, not on the way out', async () => {
    const errors = fakeErrors();
    await recordError(
      { errors, env: 'production' },
      { source: 'CLIENT', message: 'failed', context: { plan: 'FREE', apiKey: 'live_123456' } },
    );

    expect(errors.entries[0].context).toEqual({ plan: 'FREE', apiKey: REDACTED });
  });
});
