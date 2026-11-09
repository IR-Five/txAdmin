import type { PlayerIdsObjectType } from "@shared/otherTypes";
import consts from "@shared/consts";
import { shortenId } from "@shared/utils";


/**
 * Validates a single identifier and return its parts lowercased
 */
export const parsePlayerId = (idString: string) => {
    if (typeof idString !== 'string') {
        return { isIdValid: false, idType: null, idValue: null, idlowerCased: null };
    }

    const idlowerCased = idString.toLowerCase();
    const [idType, idValue] = idlowerCased.split(':', 2);
    const validator = consts.validIdentifiers[idType as keyof typeof consts.validIdentifiers];
    if (validator && validator.test(idlowerCased)) {
        return { isIdValid: true, idType, idValue, idlowerCased };
    } else {
        return { isIdValid: false, idType, idValue, idlowerCased };
    }
}


/**
 * Get valid, invalid and license identifier from array of ids
 */
export const parsePlayerIds = (ids: string[]) => {
    let invalidIdsArray: string[] = [];
    let validIdsArray: string[] = [];
    const validIdsObject: PlayerIdsObjectType = {
        discord: null,
        fivem: null,
        irfive: null,
        license: null,
        license2: null,
        live: null,
        steam: null,
        xbl: null,
    }

    for (const idString of ids) {
        if (typeof idString !== 'string') continue;
        const { isIdValid, idType, idValue, idlowerCased } = parsePlayerId(idString);
        if (isIdValid) {
            validIdsArray.push(idlowerCased!);
            validIdsObject[idType as keyof PlayerIdsObjectType] = idValue;
        } else {
            invalidIdsArray.push(idString);
        }
    }

    return { invalidIdsArray, validIdsArray, validIdsObject };
}


/**
 * Get valid and invalid player HWIDs
 */
export const filterPlayerHwids = (hwids: string[]) => {
    let invalidHwidsArray: string[] = [];
    let validHwidsArray: string[] = [];

    for (const hwidString of hwids) {
        if (typeof hwidString !== 'string') continue;
        if (consts.regexValidHwidToken.test(hwidString)) {
            validHwidsArray.push(hwidString);
        } else {
            invalidHwidsArray.push(hwidString);
        }
    }

    return { invalidHwidsArray, validHwidsArray };
}


/**
 * Attempts to parse a user-provided string into an array of valid identifiers.
 * This function is lenient and will attempt to parse any string into an array of valid identifiers.
 * Unprefixed numeric account IDs default to IRFive. Ambiguous HWIDs can use hwid:<token>.
 * Returns an array of valid ids/hwids, and array of invalid identifiers.
 * 
 * Stricter version of this function is parsePlayerIds
 */
export const parseLaxIdsArrayInput = (fullInput: string) => {
    const validIds: string[] = [];
    const validHwids: string[] = [];
    const invalids: string[] = [];

    if (typeof fullInput !== 'string') {
        return { validIds, validHwids, invalids };
    }
    const inputs = fullInput.split(/[,;\s]+/g).filter(Boolean);

    for (const rawInput of inputs) {
        const input = rawInput.toLowerCase();
        if (input.startsWith('hwid:')) {
            const hwid = rawInput.slice(5);
            if (consts.regexValidHwidToken.test(hwid)) validHwids.push(hwid);
            else invalids.push(rawInput);
            continue;
        }
        if (input.includes(':')) {
            if (consts.regexValidHwidToken.test(rawInput)) {
                validHwids.push(rawInput);
            } else if (Object.values(consts.validIdentifiers).some((regex) => regex.test(input))) {
                validIds.push(input);
            } else {
                invalids.push(rawInput);
            }
        } else if (consts.validIdentifierParts.discord.test(input)) {
            validIds.push(`discord:${input}`);
        } else if (consts.validIdentifierParts.irfive.test(input)) {
            validIds.push(`irfive:${input}`);
        } else if (consts.validIdentifierParts.steam.test(input)) {
            validIds.push(`steam:${input}`);
        } else if (/^[0-9a-f]{40}$/.test(input)) {
            // Preserve the original unprefixed FiveM license format.
            validIds.push(`license:${input}`);
        } else if (consts.regexValidHwidToken.test(rawInput)) {
            validHwids.push(rawInput);
        } else {
            invalids.push(rawInput);
        }
    }

    return { validIds, validHwids, invalids };
}


/**
 * Extracts the irfive:xxxxxx identifier from the nameid field from the userInfo oauth response.
 * Accepts the exact path returned by the IRFive SSO provider, without truncating long IDs.
 */
export const getIdFromOauthNameid = (nameid: string) => {
    try {
        if (typeof nameid !== 'string') return false;
        let pathname = nameid;
        if (nameid.startsWith('https://')) {
            const url = new URL(nameid);
            if (url.origin !== 'https://forum.irfive.ir' || url.username || url.password || url.search || url.hash) return false;
            pathname = url.pathname;
        }
        const res = /^\/(?:internal\/)?user\/([1-9][0-9]{0,7})$/.exec(pathname);
        return res ? `irfive:${res[1]}` : false;
    } catch (error) {
        return false;
    }
}


/**
 * Returns a string of shortened IDs/HWIDs
 */
export const summarizeIdsArray = (ids: string[]) => {
    if (!Array.isArray(ids)) return '<invalid list>';
    if (ids.length === 0) return '<empty list>';
    const shortList = ids.map(id => shortenId(id)).join(', ');
    return `[${shortList}]`;
}
