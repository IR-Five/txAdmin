import crypto from 'node:crypto';
import got from 'got';
import { z } from 'zod';

// This adapter uses the IRFive authorization-code + PKCE bridge, not OpenID Connect.
// No secret embedded in a distributed txAdmin client can authenticate that client.
const ssoOrigin = 'https://sso.irfive.ir';
const forumOrigin = 'https://forum.irfive.ir';
const clientId = 'txadmin';
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const tokenSchema = z.object({
    access_token: z.string().regex(tokenPattern),
    token_type: z.literal('Bearer'),
    expires_in: z.number().int().positive().max(120),
    scope: z.literal('identify'),
});
const forumUrl = z.string().url().max(2048).refine(value => {
    const url = new URL(value);
    return url.origin === forumOrigin && !url.username && !url.password;
});
const userInfoSchema = z.object({
    name: z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/),
    profile: forumUrl,
    nameid: z.string().regex(/^\/user\/[1-9][0-9]{0,7}$/),
    picture: forumUrl.optional(),
});
export type UserInfoType = z.infer<typeof userInfoSchema> & { picture: string | undefined };

const same = (a: string, b: string) => Buffer.byteLength(a) === Buffer.byteLength(b)
    && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('base64url');
const stateFor = (seed: string) => hash(`tx:irfive:state:${seed}`);
const verifierFor = (seed: string) => hash(`tx:irfive:pkce:${seed}`);
const checkSeed = (seed: string) => {
    const match = /^(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(seed);
    if (!match || Date.now() - Number(match[1]) > 300000 || Number(match[1]) > Date.now() + 30000) {
        throw new Error('invalid_session');
    }
};
const checkCallbackUrl = (value: string) => {
    const url = new URL(value);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.hash || url.search
        || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
        || !['/login/callback', '/addMaster/callback'].includes(url.pathname)) throw new Error('invalid_session');
    return url;
};

export default class CfxProvider {
    getAuthURL(redirectUri: string, stateKern: string) {
        checkSeed(stateKern);
        checkCallbackUrl(redirectUri);
        const url = new URL('/connect/authorize', ssoOrigin);
        url.search = new URLSearchParams({
            client_id: clientId, response_type: 'code', redirect_uri: redirectUri,
            scope: 'identify', state: stateFor(stateKern),
            code_challenge: hash(verifierFor(stateKern)), code_challenge_method: 'S256',
        }).toString();
        return url.href;
    }

    async processCallback(sessionCallbackUri: string, sessionStateKern: string, callbackUri: string) {
        checkSeed(sessionStateKern);
        const expected = checkCallbackUrl(sessionCallbackUri);
        const actual = new URL(callbackUri);
        if (actual.origin !== expected.origin || actual.pathname !== expected.pathname
            || actual.username || actual.password || actual.hash || callbackUri.length > 4096) throw new Error('invalid_state');
        const params = actual.searchParams;
        for (const key of params.keys()) {
            if (!['code', 'state', 'error', 'error_description'].includes(key)
                || params.getAll(key).length !== 1) throw new Error('invalid_state');
        }
        const state = params.get('state');
        if (!state || !same(state, stateFor(sessionStateKern))) throw new Error('invalid_state');
        if (params.has('error')) throw new Error('provider_rejected');
        const code = params.get('code');
        if (!code || !tokenPattern.test(code)) throw new Error('invalid_state');

        const result = await got.post(`${ssoOrigin}/connect/token`, {
            form: { grant_type: 'authorization_code', client_id: clientId, code,
                redirect_uri: sessionCallbackUri, code_verifier: verifierFor(sessionStateKern) },
            timeout: { request: 10000 }, retry: { limit: 0 }, followRedirect: false,
        }).json<unknown>();
        const token = tokenSchema.parse(result);
        return { access_token: token.access_token, expires_at: Math.floor(Date.now() / 1000) + token.expires_in };
    }

    async getUserInfo(accessToken: string): Promise<UserInfoType> {
        if (!tokenPattern.test(accessToken)) throw new Error('invalid_token');
        const result = await got.get(`${ssoOrigin}/connect/userinfo`, {
            headers: { authorization: `Bearer ${accessToken}` },
            timeout: { request: 10000 }, retry: { limit: 0 }, followRedirect: false,
        }).json<unknown>();
        const user = userInfoSchema.parse(result);
        return { ...user, picture: user.picture };
    }
}
