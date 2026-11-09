import consts from '@shared/consts';
import got from '@lib/got';
import { z } from 'zod';

export type AdminIdentity = { id: string; identifier: string };

/** Explicit namespaces never translate between Cfx and IRFive accounts. */
export const resolveAdminIdentity = async (input: string): Promise<AdminIdentity | false> => {
    const value = input.trim();
    if (!value) return false;
    const lower = value.toLowerCase();
    if (consts.validIdentifiers.irfive.test(lower) || consts.validIdentifiers.fivem.test(lower)) {
        return { id: lower, identifier: lower };
    }
    if (consts.validIdentifierParts.irfive.test(value)) {
        const identifier = `irfive:${value}`;
        return { id: identifier, identifier };
    }
    if (!/^[A-Za-z0-9_.-]{1,64}$/.test(value)) throw new Error('Invalid IRFive identifier or forum username.');
    try {
        const response = await got(`https://forum.irfive.ir/u/${encodeURIComponent(value)}.json`, {
            timeout: { request: 6000 }, retry: { limit: 0 }, followRedirect: false,
        }).json<unknown>();
        const schema = z.object({ user: z.object({
            id: z.number().int().min(1).max(99999999),
            username: z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/),
        }) });
        const { user } = schema.parse(response);
        if (user.username.toLowerCase() !== lower) throw new Error('Account lookup mismatch');
        const identifier = `irfive:${user.id}`;
        return { id: user.username.length >= 3 ? user.username : identifier, identifier };
    } catch {
        throw new Error('Could not resolve the IRFive forum username. Check the username or enter irfive:<id>.');
    }
};
