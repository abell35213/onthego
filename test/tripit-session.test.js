const test = require('node:test');
const assert = require('node:assert/strict');

process.env.YELP_API_KEY = process.env.YELP_API_KEY || 'test-yelp-key';

const { app, tripitTestHooks } = require('../server');

const {
  getTripItAccessToken,
  getTripItSessionId,
  parseCookies,
  tripitAccessTokens,
  TRIPIT_SESSION_COOKIE_NAME
} = tripitTestHooks;

function getCookieHeader(response) {
  const setCookieHeader = response.headers.get('set-cookie');
  return setCookieHeader || '';
}

async function withServer(run) {
  const server = app.listen(0);

  try {
    const { port } = server.address();
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

test('parseCookies decodes cookie values and getTripItSessionId reads the TripIt cookie', () => {
  const req = {
    headers: {
      cookie: `foo=bar; ${TRIPIT_SESSION_COOKIE_NAME}=session%20123; theme=dark`
    }
  };

  assert.deepEqual(parseCookies(req.headers.cookie), {
    foo: 'bar',
    [TRIPIT_SESSION_COOKIE_NAME]: 'session 123',
    theme: 'dark'
  });
  assert.equal(getTripItSessionId(req), 'session 123');
});

test('getTripItAccessToken rejects missing and unknown sessions', () => {
  assert.deepEqual(getTripItAccessToken({ headers: {} }), {
    sessionId: '',
    accessToken: null,
    error: 'TripIt session cookie is required'
  });

  assert.deepEqual(getTripItAccessToken({
    headers: { cookie: `${TRIPIT_SESSION_COOKIE_NAME}=missing-session` }
  }), {
    sessionId: 'missing-session',
    accessToken: null,
    error: 'Invalid or expired TripIt session'
  });
});

test('GET /api/tripit/status reports disconnected without a session cookie', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/tripit/status`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { connected: false });
    assert.equal(getCookieHeader(response), '');
  });
});

test('GET /api/tripit/status clears invalid TripIt session cookies', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/tripit/status`, {
      headers: {
        Cookie: `${TRIPIT_SESSION_COOKIE_NAME}=expired-session`
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { connected: false });
    assert.match(getCookieHeader(response), new RegExp(`^${TRIPIT_SESSION_COOKIE_NAME}=;`));
    assert.match(getCookieHeader(response), /HttpOnly/i);
    assert.match(getCookieHeader(response), /Secure/i);
    assert.match(getCookieHeader(response), /SameSite=Lax/i);
  });
});

test('POST /api/tripit/disconnect removes the stored session and expires the cookie', async () => {
  const sessionId = 'session-to-remove';
  tripitAccessTokens.set(sessionId, { key: 'oauth-key', secret: 'oauth-secret' });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/tripit/disconnect`, {
        method: 'POST',
        headers: {
          Cookie: `${TRIPIT_SESSION_COOKIE_NAME}=${sessionId}`
        }
      });

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { success: true });
      assert.equal(tripitAccessTokens.has(sessionId), false);
      assert.match(getCookieHeader(response), new RegExp(`^${TRIPIT_SESSION_COOKIE_NAME}=;`));
    });
  } finally {
    tripitAccessTokens.delete(sessionId);
  }
});
