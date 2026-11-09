const modulename = 'WebServer:OauthMethods';
import type { InitializedCtx } from '@modules/WebServer/ctxTypes';
import type { ValidSessionType } from '@modules/WebServer/middlewares/sessionMws';
import type { ApiOauthCallbackErrorResp } from '@shared/authApiTypes';
import type { UserInfoType } from '@modules/AdminStore/providers/CitizenFX';
import { randomBytes } from 'node:crypto';
import consoleFactory from '@lib/console';
const console = consoleFactory(modulename);

export const getOauthRedirectUrl = (ctx: InitializedCtx, purpose: 'login' | 'addMaster', origin: string) => {
    const url = new URL(origin);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Invalid panel origin');
    const callbackUrl = url.origin + `/${purpose}/callback`;
    const sessData = {
        // Timestamp enforces a five-minute absolute lifetime; 32 random bytes supply entropy.
        tmpOauthLoginStateKern: `${Date.now()}.${randomBytes(32).toString('base64url')}`,
        tmpOauthLoginCallbackUri: callbackUrl,
    } satisfies ValidSessionType;
    const authUrl = txCore.adminStore.providers.citizenfx.getAuthURL(callbackUrl, sessData.tmpOauthLoginStateKern);
    ctx.sessTools.set(sessData);
    return authUrl;
};

export const handleOauthCallback = async (
    ctx: InitializedCtx, redirectUri: string
): Promise<ApiOauthCallbackErrorResp | UserInfoType> => {
    const inbound = ctx.sessTools.get();
    if (!inbound?.tmpOauthLoginStateKern || !inbound.tmpOauthLoginCallbackUri) return { errorCode: 'invalid_session' };
    // Clear the pending transaction before any asynchronous work, preventing reuse.
    ctx.sessTools.set({
        ...inbound,
        tmpOauthLoginStateKern: undefined,
        tmpOauthLoginCallbackUri: undefined,
    });
    try {
        const tokenSet = await txCore.adminStore.providers.citizenfx.processCallback(
            inbound.tmpOauthLoginCallbackUri, inbound.tmpOauthLoginStateKern, redirectUri,
        );
        return await txCore.adminStore.providers.citizenfx.getUserInfo(tokenSet.access_token);
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        // HTTP client errors may contain sensitive request metadata: never log the error object.
        console.warn('IRFive login failed. Start a new login attempt.');
        if (message === 'invalid_state') return { errorCode: 'invalid_state' };
        if (message === 'invalid_session') return { errorCode: 'invalid_session' };
        return { errorTitle: 'IRFive login failed', errorMessage: 'Login expired or could not be verified. Please try again.' };
    }
};
