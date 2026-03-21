const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_STORE_DIRECTORY = process.env.XDG_DATA_HOME
    ? path.join(process.env.XDG_DATA_HOME, 'onthego')
    : path.join(os.homedir(), '.onthego');
const DEFAULT_STORE_PATH = path.join(DEFAULT_STORE_DIRECTORY, 'tripit-oauth-store.json');
const REQUEST_TOKEN_TTL_MS = 10 * 60 * 1000;

const normalizeStoreShape = (store) => ({
    requestTokens: Array.isArray(store?.requestTokens) ? store.requestTokens : [],
    accessTokens: Array.isArray(store?.accessTokens) ? store.accessTokens : []
});

class TripItTokenStore {
    constructor(storePath = process.env.TRIPIT_TOKEN_STORE_PATH || DEFAULT_STORE_PATH) {
        this.storePath = storePath;
        this.writeQueue = Promise.resolve();
    }

    async initialize() {
        await fs.mkdir(path.dirname(this.storePath), { recursive: true });

        try {
            await fs.access(this.storePath);
        } catch {
            await fs.writeFile(
                this.storePath,
                JSON.stringify(normalizeStoreShape(), null, 2),
                'utf8'
            );
        }
    }

    async withStore(mutator) {
        this.writeQueue = this.writeQueue.then(async () => {
            await this.initialize();
            const current = await this.readStore();
            const updated = await mutator(current) || current;
            await this.writeStore(updated);
            return updated;
        });

        return this.writeQueue;
    }

    async readStore() {
        await this.initialize();
        const raw = await fs.readFile(this.storePath, 'utf8');
        return normalizeStoreShape(JSON.parse(raw));
    }

    async writeStore(store) {
        const normalized = normalizeStoreShape(store);
        await fs.writeFile(this.storePath, JSON.stringify(normalized, null, 2), 'utf8');
    }

    async saveRequestToken({ oauthToken, oauthTokenSecret, state, userId, callbackUrl }) {
        const createdAt = new Date().toISOString();

        await this.withStore((store) => {
            store.requestTokens = store.requestTokens.filter((record) => record.oauth_token !== oauthToken);
            store.requestTokens.push({
                oauth_token: oauthToken,
                oauth_token_secret: oauthTokenSecret,
                state,
                created_at: createdAt,
                user_id: userId,
                callback_url: callbackUrl
            });
            return store;
        });

        return { createdAt };
    }

    async getRequestToken(oauthToken) {
        const store = await this.readStore();
        const record = store.requestTokens.find((entry) => entry.oauth_token === oauthToken) || null;
        if (!record) {
            return null;
        }

        const createdAtMs = Date.parse(record.created_at);
        if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > REQUEST_TOKEN_TTL_MS) {
            await this.deleteRequestToken(oauthToken);
            return null;
        }

        return record;
    }

    async deleteRequestToken(oauthToken) {
        await this.withStore((store) => {
            store.requestTokens = store.requestTokens.filter((record) => record.oauth_token !== oauthToken);
            return store;
        });
    }

    async cleanupExpiredRequestTokens(now = Date.now()) {
        let deletedCount = 0;

        await this.withStore((store) => {
            const beforeCount = store.requestTokens.length;
            store.requestTokens = store.requestTokens.filter((record) => {
                const createdAtMs = Date.parse(record.created_at);
                if (!Number.isFinite(createdAtMs)) {
                    return false;
                }

                return now - createdAtMs <= REQUEST_TOKEN_TTL_MS;
            });
            deletedCount = beforeCount - store.requestTokens.length;
            return store;
        });

        return deletedCount;
    }

    async saveAccessToken({ sessionRef, userId, oauthToken, oauthTokenSecret, tripitUserRef }) {
        const createdAt = new Date().toISOString();

        await this.withStore((store) => {
            store.accessTokens = store.accessTokens.filter((record) => {
                if (record.session_ref === sessionRef) {
                    return false;
                }

                return !(record.user_id === userId && record.revoked_at === null);
            });

            store.accessTokens.push({
                session_ref: sessionRef,
                user_id: userId,
                oauth_token: oauthToken,
                oauth_token_secret: oauthTokenSecret,
                tripit_user_ref: tripitUserRef || null,
                created_at: createdAt,
                revoked_at: null
            });
            return store;
        });

        return { createdAt };
    }

    async getActiveAccessToken(sessionRef, userId) {
        const store = await this.readStore();
        return store.accessTokens.find((record) => (
            record.session_ref === sessionRef
            && record.user_id === userId
            && record.revoked_at === null
        )) || null;
    }

    async getActiveAccessTokenBySession(sessionRef) {
        const store = await this.readStore();
        return store.accessTokens.find((record) => (
            record.session_ref === sessionRef
            && record.revoked_at === null
        )) || null;
    }

    async revokeAccessToken(sessionRef, userId) {
        let revoked = false;

        await this.withStore((store) => {
            store.accessTokens = store.accessTokens.map((record) => {
                if (record.session_ref === sessionRef && record.user_id === userId && record.revoked_at === null) {
                    revoked = true;
                    return {
                        ...record,
                        revoked_at: new Date().toISOString()
                    };
                }

                return record;
            });
            return store;
        });

        return revoked;
    }

    async revokeAccessTokenBySession(sessionRef) {
        let revoked = false;

        await this.withStore((store) => {
            store.accessTokens = store.accessTokens.map((record) => {
                if (record.session_ref === sessionRef && record.revoked_at === null) {
                    revoked = true;
                    return {
                        ...record,
                        revoked_at: new Date().toISOString()
                    };
                }

                return record;
            });
            return store;
        });

        return revoked;
    }
}

module.exports = {
    TripItTokenStore,
    REQUEST_TOKEN_TTL_MS,
    DEFAULT_STORE_PATH
};
