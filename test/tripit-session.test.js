const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onthego-tripit-session-'));
process.env.TRIPIT_TOKEN_STORE_PATH = path.join(tempDir, 'tripit-store.json');
process.env.TRIPIT_API_KEY = process.env.TRIPIT_API_KEY || 'test-tripit-key';
process.env.TRIPIT_API_SECRET = process.env.TRIPIT_API_SECRET || 'test-tripit-secret';
process.env.YELP_API_KEY = process.env.YELP_API_KEY || 'test-yelp-key';

const { app } = require('../server');
const { TripItTokenStore } = require('../lib/tripit-token-store');

const tokenStore = new TripItTokenStore(process.env.TRIPIT_TOKEN_STORE_PATH);
const TRIPIT_SESSION_COOKIE_NAME = 'onthego_tripit_session';

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

async function seedActiveSession({
  sessionId,
  userId = 'user-1',
  oauthToken = 'access-token',
  oauthTokenSecret = 'access-secret',
  tripitUserRef = 'tripit-user-1'
}) {
  await tokenStore.saveAccessToken({
    sessionRef: sessionId,
    userId,
    oauthToken,
    oauthTokenSecret,
    tripitUserRef
  });
}

function createJsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers
    }
  });
}

test.after(async () => {
  await fsp.rm(tempDir, { recursive: true, force: true });
});

test('GET /api/tripit/status reports disconnected without a session cookie', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/tripit/status`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { connected: false, lastSync: null, accountLabel: null });
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
    assert.deepEqual(await response.json(), { connected: false, lastSync: null, accountLabel: null });
    assert.match(getCookieHeader(response), new RegExp(`^${TRIPIT_SESSION_COOKIE_NAME}=;`));
    assert.match(getCookieHeader(response), /HttpOnly/i);
    assert.match(getCookieHeader(response), /Secure/i);
    assert.match(getCookieHeader(response), /SameSite=Lax/i);
  });
});

test('GET /api/tripit/status reports connected for an active cookie-backed session', async () => {
  const sessionId = 'active-session';
  await seedActiveSession({ sessionId });

  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/tripit/status`, {
      headers: {
        Cookie: `${TRIPIT_SESSION_COOKIE_NAME}=${sessionId}`
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { connected: true, lastSync: null, accountLabel: 'tripit-user-1' });
    assert.equal(getCookieHeader(response), '');
  });
});

test('GET /api/tripit/status includes the last sync timestamp for the authenticated session owner', async () => {
  const sessionId = 'active-session-with-sync';
  const userId = 'user-with-sync';
  await seedActiveSession({ sessionId, userId, tripitUserRef: 'tripit-sync-user' });
  await tokenStore.updateLastTripSyncAt({
    sessionRef: sessionId,
    userId,
    syncedAt: '2026-03-20T08:30:00.000Z'
  });

  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/tripit/status`, {
      headers: {
        Cookie: `${TRIPIT_SESSION_COOKIE_NAME}=${sessionId}`,
        'x-onthego-user-ref': userId
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      connected: true,
      lastSync: '2026-03-20T08:30:00.000Z',
      accountLabel: 'tripit-sync-user'
    });
    assert.equal(getCookieHeader(response), '');
  });
});

test('GET /api/tripit/status falls back to session lookup when the client user header is stale', async () => {
  const sessionId = 'active-session-stale-header';
  await seedActiveSession({
    sessionId,
    userId: 'actual-user',
    tripitUserRef: 'tripit-actual-user'
  });

  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/tripit/status`, {
      headers: {
        Cookie: `${TRIPIT_SESSION_COOKIE_NAME}=${sessionId}`,
        'x-onthego-user-ref': 'stale-user'
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      connected: true,
      lastSync: null,
      accountLabel: 'tripit-actual-user'
    });
    assert.equal(getCookieHeader(response), '');
  });
});


test('POST /api/tripit/disconnect revokes the cookie-backed session and expires the cookie', async () => {
  const sessionId = 'session-to-remove';
  await seedActiveSession({ sessionId, userId: 'user-disconnect' });

  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/tripit/disconnect`, {
      method: 'POST',
      headers: {
        Cookie: `${TRIPIT_SESSION_COOKIE_NAME}=${sessionId}`,
        'x-onthego-user-ref': 'user-disconnect'
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, connected: false, revoked: true });
    assert.equal(await tokenStore.getActiveAccessToken('session-to-remove', 'user-disconnect'), null);
    assert.match(getCookieHeader(response), new RegExp(`^${TRIPIT_SESSION_COOKIE_NAME}=;`));
  });
});

test('POST /api/tripit/disconnect falls back to revoking the session when the client user header is stale', async () => {
  const sessionId = 'session-fallback-revoke';
  await seedActiveSession({ sessionId, userId: 'actual-user', tripitUserRef: 'tripit-fallback-user' });

  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/tripit/disconnect`, {
      method: 'POST',
      headers: {
        Cookie: `${TRIPIT_SESSION_COOKIE_NAME}=${sessionId}`,
        'x-onthego-user-ref': 'stale-user'
      }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, connected: false, revoked: true });
    assert.equal(await tokenStore.getActiveAccessTokenBySession(sessionId), null);
    assert.match(getCookieHeader(response), new RegExp(`^${TRIPIT_SESSION_COOKIE_NAME}=;`));
  });
});


test('GET /api/tripit/trips rejects unknown sessions before contacting TripIt', async () => {
  await withServer(async (baseUrl) => {
    const originalFetch = global.fetch;
    let fetchCalled = false;
    global.fetch = async (...args) => {
      const [url] = args;
      if (typeof url === 'string' && url.startsWith('https://api.tripit.com/')) {
        fetchCalled = true;
      }
      return originalFetch(...args);
    };

    try {
      const response = await fetch(`${baseUrl}/api/tripit/trips`, {
        headers: {
          Cookie: `${TRIPIT_SESSION_COOKIE_NAME}=missing-session`,
          'x-onthego-user-ref': 'user-1'
        }
      });

      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), {
        error: 'Authorization expired, please reconnect your TripIt account.',
        code: 'tripit_authorization_expired',
        status: 401
      });
      assert.equal(fetchCalled, false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test('GET /api/tripit/trips fetches all available TripIt pages, forwards supported query params, and de-duplicates trips', async () => {
  const sessionId = 'session-pages';
  const userId = 'user-pages';
  await seedActiveSession({ sessionId, userId });

  await withServer(async (baseUrl) => {
    const originalFetch = global.fetch;
    const tripitCalls = [];

    global.fetch = async (url, options = {}) => {
      if (typeof url === 'string' && url.startsWith('https://api.tripit.com/')) {
        tripitCalls.push({ url, options });
        const parsedUrl = new URL(url);
        const pageNum = parsedUrl.searchParams.get('page_num');

        if (pageNum === '1') {
          return createJsonResponse({
            page_num: '1',
            max_page: '2',
            page_size: '2',
            Trip: [
              { id: 'trip-1', start_date: '2026-03-21', end_date: '2026-03-22' },
              { id: 'trip-2', start_date: '2026-03-23', end_date: '2026-03-24' }
            ]
          });
        }

        return createJsonResponse({
          page_num: '2',
          max_page: '2',
          page_size: '2',
          Trip: [
            { id: 'trip-2', start_date: '2026-03-23', end_date: '2026-03-24' },
            { id: 'trip-3', start_date: '2026-03-25', end_date: '2026-03-26' }
          ]
        });
      }

      return originalFetch(url, options);
    };

    try {
      const response = await fetch(`${baseUrl}/api/tripit/trips?past=true&include_objects=true&modified_since=2026-03-01T00:00:00Z`, {
        headers: {
          Cookie: `${TRIPIT_SESSION_COOKIE_NAME}=${sessionId}`,
          'x-onthego-user-ref': userId
        }
      });

      assert.equal(response.status, 200);

      const payload = await response.json();
      assert.deepEqual(payload.Trip.map((trip) => trip.id), ['trip-1', 'trip-2', 'trip-3']);
      assert.deepEqual(payload.sync_metadata, {
        requested_pages: 2,
        max_page: 2,
        page_size: 2,
        truncated: false
      });

      assert.equal(tripitCalls.length, 2);
      for (const call of tripitCalls) {
        const parsedUrl = new URL(call.url);
        assert.equal(parsedUrl.pathname, '/v1/list/trip');
        assert.equal(parsedUrl.searchParams.get('format'), 'json');
        assert.equal(parsedUrl.searchParams.get('past'), 'true');
        assert.equal(parsedUrl.searchParams.get('include_objects'), 'true');
        assert.equal(parsedUrl.searchParams.get('modified_since'), '2026-03-01T00:00:00Z');
        assert.equal(call.options.headers.Accept, 'application/json');
      }

      const updatedToken = await tokenStore.getActiveAccessToken(sessionId, userId);
      assert.ok(updatedToken.last_trip_sync_at);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test('GET /api/tripit/trips uses the last successful sync timestamp when modified_since is not provided', async () => {
  const sessionId = 'session-incremental';
  const userId = 'user-incremental';
  await seedActiveSession({ sessionId, userId });
  await tokenStore.updateLastTripSyncAt({
    sessionRef: sessionId,
    userId,
    syncedAt: '2026-03-18T12:00:00.000Z'
  });

  await withServer(async (baseUrl) => {
    const originalFetch = global.fetch;
    let requestUrl = '';

    global.fetch = async (url, options = {}) => {
      if (typeof url === 'string' && url.startsWith('https://api.tripit.com/')) {
        requestUrl = url;
        return createJsonResponse({
          page_num: '1',
          max_page: '1',
          page_size: '1',
          Trip: [{ id: 'trip-10', start_date: '2026-03-28', end_date: '2026-03-29' }]
        });
      }

      return originalFetch(url, options);
    };

    try {
      const response = await fetch(`${baseUrl}/api/tripit/trips`, {
        headers: {
          Cookie: `${TRIPIT_SESSION_COOKIE_NAME}=${sessionId}`,
          'x-onthego-user-ref': userId
        }
      });

      assert.equal(response.status, 200);
      assert.equal(new URL(requestUrl).searchParams.get('modified_since'), '2026-03-18T12:00:00.000Z');
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test('GET /api/tripit/trips returns retry-friendly errors for TripIt rate limits', async () => {
  const sessionId = 'session-rate-limit';
  const userId = 'user-rate-limit';
  await seedActiveSession({ sessionId, userId });

  await withServer(async (baseUrl) => {
    const originalFetch = global.fetch;

    global.fetch = async (url, options = {}) => {
      if (typeof url === 'string' && url.startsWith('https://api.tripit.com/')) {
        return createJsonResponse(
          { error: 'rate limited' },
          {
            status: 429,
            headers: {
              'retry-after': '60'
            }
          }
        );
      }

      return originalFetch(url, options);
    };

    try {
      const response = await fetch(`${baseUrl}/api/tripit/trips`, {
        headers: {
          Cookie: `${TRIPIT_SESSION_COOKIE_NAME}=${sessionId}`,
          'x-onthego-user-ref': userId
        }
      });

      assert.equal(response.status, 429);
      assert.deepEqual(await response.json(), {
        error: 'TripIt API temporarily unavailable',
        code: 'tripit_api_temporarily_unavailable',
        status: 429,
        retry_after: '60'
      });
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test('GET /api/tripit/trips caps TripIt pagination to protect server resources', async () => {
  const sessionId = 'session-page-cap';
  const userId = 'user-page-cap';
  await seedActiveSession({ sessionId, userId });

  await withServer(async (baseUrl) => {
    const originalFetch = global.fetch;
    const requestedPages = [];

    global.fetch = async (url, options = {}) => {
      if (typeof url === 'string' && url.startsWith('https://api.tripit.com/')) {
        const parsedUrl = new URL(url);
        const pageNum = Number(parsedUrl.searchParams.get('page_num'));
        requestedPages.push(pageNum);

        return createJsonResponse({
          page_num: String(pageNum),
          max_page: '9',
          page_size: '1',
          Trip: [{ id: `trip-cap-${pageNum}`, start_date: '2026-04-01', end_date: '2026-04-02' }]
        });
      }

      return originalFetch(url, options);
    };

    try {
      const response = await fetch(`${baseUrl}/api/tripit/trips`, {
        headers: {
          Cookie: `${TRIPIT_SESSION_COOKIE_NAME}=${sessionId}`,
          'x-onthego-user-ref': userId
        }
      });

      assert.equal(response.status, 200);
      assert.equal(response.headers.get('x-onthego-tripit-pages-truncated'), 'true');

      const payload = await response.json();
      assert.deepEqual(requestedPages, [1, 2, 3, 4, 5]);
      assert.equal(payload.sync_metadata.truncated, true);
      assert.equal(payload.sync_metadata.requested_pages, 5);
      assert.deepEqual(payload.Trip.map((trip) => trip.id), [
        'trip-cap-1',
        'trip-cap-2',
        'trip-cap-3',
        'trip-cap-4',
        'trip-cap-5'
      ]);
    } finally {
      global.fetch = originalFetch;
    }
  });
});


test('GET /api/tripit/connect parses TripIt OAuth error codes into safe payloads', async () => {
  await withServer(async (baseUrl) => {
    const originalFetch = global.fetch;

    global.fetch = async (url, options = {}) => {
      if (typeof url === 'string' && url === 'https://api.tripit.com/oauth/request_token') {
        return new Response('oauth_problem=consumer_key_unknown&oauth_problem_advice=check%20key', {
          status: 401,
          headers: {
            'content-type': 'application/x-www-form-urlencoded'
          }
        });
      }

      return originalFetch(url, options);
    };

    try {
      const response = await fetch(`${baseUrl}/api/tripit/connect?callback=${encodeURIComponent(`${baseUrl}/api/tripit/callback`)}`, {
        headers: {
          'x-onthego-user-ref': 'user-connect'
        }
      });

      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), {
        error: 'TripIt connection is temporarily unavailable. Please contact support.',
        code: 'tripit_invalid_consumer_key',
        status: 401,
        tripit_code: 'consumer_key_unknown'
      });
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test('GET /api/tripit/trips maps expired TripIt authorization errors for reconnect flows', async () => {
  const sessionId = 'session-expired-auth';
  const userId = 'user-expired-auth';
  await seedActiveSession({ sessionId, userId });

  await withServer(async (baseUrl) => {
    const originalFetch = global.fetch;

    global.fetch = async (url, options = {}) => {
      if (typeof url === 'string' && url.startsWith('https://api.tripit.com/')) {
        return new Response('oauth_problem=token_rejected', {
          status: 401,
          headers: {
            'content-type': 'application/x-www-form-urlencoded'
          }
        });
      }

      return originalFetch(url, options);
    };

    try {
      const response = await fetch(`${baseUrl}/api/tripit/trips`, {
        headers: {
          Cookie: `${TRIPIT_SESSION_COOKIE_NAME}=${sessionId}`,
          'x-onthego-user-ref': userId
        }
      });

      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), {
        error: 'Authorization expired, please reconnect your TripIt account.',
        code: 'tripit_authorization_expired',
        status: 401,
        tripit_code: 'token_rejected'
      });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
