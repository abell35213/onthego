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

test.after(async () => {
  await fsp.rm(tempDir, { recursive: true, force: true });
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
    assert.deepEqual(await response.json(), { connected: true });
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
      assert.deepEqual(await response.json(), { error: 'Invalid or expired TripIt session' });
      assert.equal(fetchCalled, false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
