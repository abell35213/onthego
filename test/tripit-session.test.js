const test = require('node:test');
const assert = require('node:assert/strict');

process.env.YELP_API_KEY = process.env.YELP_API_KEY || 'test-yelp-key';

const {
  buildTripItSessionCookie,
  clearTripItSession,
  getTripItAccessToken,
  getTripItSessionId,
  parseCookies,
  tripitAccessTokens
} = require('../server');

test('parseCookies decodes cookie values and getTripItSessionId reads the TripIt cookie', () => {
  const req = {
    headers: {
      cookie: 'foo=bar; onthego_tripit_session=session%20123; theme=dark'
    }
  };

  assert.deepEqual(parseCookies(req.headers.cookie), {
    foo: 'bar',
    onthego_tripit_session: 'session 123',
    theme: 'dark'
  });
  assert.equal(getTripItSessionId(req), 'session 123');
});

test('buildTripItSessionCookie applies secure HttpOnly SameSite attributes', () => {
  const cookie = buildTripItSessionCookie('abc123', 5_000);

  assert.match(cookie, /^onthego_tripit_session=abc123;/);
  assert.match(cookie, /; Path=\//);
  assert.match(cookie, /; HttpOnly/);
  assert.match(cookie, /; Secure/);
  assert.match(cookie, /; SameSite=Lax/);
  assert.match(cookie, /; Max-Age=5$/);
});

test('getTripItAccessToken resolves a valid session cookie and rejects missing/unknown sessions', () => {
  const sessionId = 'valid-session';
  const tokenRecord = { key: 'oauth-key', secret: 'oauth-secret' };
  tripitAccessTokens.set(sessionId, tokenRecord);

  try {
    assert.deepEqual(getTripItAccessToken({ headers: {} }), {
      sessionId: '',
      accessToken: null,
      error: 'TripIt session cookie is required'
    });

    assert.deepEqual(getTripItAccessToken({
      headers: { cookie: 'onthego_tripit_session=missing-session' }
    }), {
      sessionId: 'missing-session',
      accessToken: null,
      error: 'Invalid or expired TripIt session'
    });

    assert.deepEqual(getTripItAccessToken({
      headers: { cookie: `onthego_tripit_session=${sessionId}` }
    }), {
      sessionId,
      accessToken: tokenRecord,
      error: null
    });
  } finally {
    tripitAccessTokens.delete(sessionId);
  }
});

test('clearTripItSession removes the stored session and expires the cookie', () => {
  const sessionId = 'to-clear';
  tripitAccessTokens.set(sessionId, { key: 'oauth-key', secret: 'oauth-secret' });

  const res = {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    }
  };

  clearTripItSession(res, sessionId);

  assert.equal(tripitAccessTokens.has(sessionId), false);
  assert.match(res.headers['Set-Cookie'], /^onthego_tripit_session=;/);
  assert.match(res.headers['Set-Cookie'], /; Max-Age=0$/);
});
