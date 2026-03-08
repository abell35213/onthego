const test = require('node:test');
const assert = require('node:assert/strict');

const handler = require('../api/yelp-search');

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test('returns 400 when latitude/longitude are missing', async () => {
  process.env.YELP_API_KEY = 'test-key';
  const req = { method: 'POST', body: {} };
  const res = createRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'latitude and longitude are required' });
});

test('accepts 0 latitude/longitude values', async () => {
  process.env.YELP_API_KEY = 'test-key';

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ businesses: [] })
  });

  const req = {
    method: 'POST',
    body: { latitude: 0, longitude: 0 }
  };
  const res = createRes();

  try {
    await handler(req, res);
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { businesses: [] });
});
