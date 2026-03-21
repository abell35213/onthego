const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { TripItTokenStore, REQUEST_TOKEN_TTL_MS, DEFAULT_STORE_PATH } = require('../lib/tripit-token-store');

const createStore = async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tripit-token-store-'));
    const storePath = path.join(dir, 'store.json');
    const store = new TripItTokenStore(storePath);
    await store.initialize();
    return { dir, store, storePath };
};

test('default token store path lives outside the static web root', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const relativePath = path.relative(repoRoot, DEFAULT_STORE_PATH);

    assert.equal(relativePath.startsWith('..'), true);
});

test('persists request tokens and removes expired entries', async () => {
    const { dir, store } = await createStore();

    try {
        await store.saveRequestToken({
            oauthToken: 'request-token',
            oauthTokenSecret: 'request-secret',
            state: 'state-1',
            userId: 'user-1',
            callbackUrl: 'http://localhost/api/tripit/callback?state=state-1'
        });

        const persisted = await store.getRequestToken('request-token');
        assert.equal(persisted.oauth_token_secret, 'request-secret');
        assert.equal(persisted.user_id, 'user-1');

        const expiredNow = Date.parse(persisted.created_at) + REQUEST_TOKEN_TTL_MS + 1;
        const deletedCount = await store.cleanupExpiredRequestTokens(expiredNow);
        assert.equal(deletedCount, 1);
        assert.equal(await store.getRequestToken('request-token'), null);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

test('scopes access token lookups and revocation to the authenticated app user', async () => {
    const { dir, store } = await createStore();

    try {
        await store.saveAccessToken({
            sessionRef: 'session-1',
            userId: 'user-1',
            oauthToken: 'access-token',
            oauthTokenSecret: 'access-secret',
            tripitUserRef: 'tripit-user-1'
        });

        const allowed = await store.getActiveAccessToken('session-1', 'user-1');
        assert.equal(allowed.oauth_token, 'access-token');
        assert.equal(allowed.tripit_user_ref, 'tripit-user-1');
        assert.equal(allowed.last_trip_sync_at, null);
        assert.equal((await store.getActiveAccessTokenBySession('session-1')).user_id, 'user-1');

        const blocked = await store.getActiveAccessToken('session-1', 'user-2');
        assert.equal(blocked, null);

        const revokedWrongUser = await store.revokeAccessToken('session-1', 'user-2');
        assert.equal(revokedWrongUser, false);
        assert.notEqual(await store.getActiveAccessToken('session-1', 'user-1'), null);

        const revoked = await store.revokeAccessToken('session-1', 'user-1');
        assert.equal(revoked, true);
        assert.equal(await store.getActiveAccessToken('session-1', 'user-1'), null);
        assert.equal(await store.getActiveAccessTokenBySession('session-1'), null);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

test('records the last successful TripIt sync timestamp for an active token', async () => {
    const { dir, store } = await createStore();

    try {
        await store.saveAccessToken({
            sessionRef: 'session-sync',
            userId: 'user-sync',
            oauthToken: 'access-sync',
            oauthTokenSecret: 'access-secret-sync',
            tripitUserRef: 'tripit-user-sync'
        });

        const syncedAt = '2026-03-20T08:30:00.000Z';
        assert.equal(
            await store.updateLastTripSyncAt({
                sessionRef: 'session-sync',
                userId: 'user-sync',
                syncedAt
            }),
            true
        );

        const updated = await store.getActiveAccessToken('session-sync', 'user-sync');
        assert.equal(updated.last_trip_sync_at, syncedAt);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

test('can revoke an active session without knowing the app user id', async () => {
    const { dir, store } = await createStore();

    try {
        await store.saveAccessToken({
            sessionRef: 'session-cookie',
            userId: 'user-cookie',
            oauthToken: 'access-cookie',
            oauthTokenSecret: 'access-secret-cookie',
            tripitUserRef: 'tripit-user-cookie'
        });

        assert.notEqual(await store.getActiveAccessTokenBySession('session-cookie'), null);
        assert.equal(await store.revokeAccessTokenBySession('session-cookie'), true);
        assert.equal(await store.getActiveAccessTokenBySession('session-cookie'), null);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});
