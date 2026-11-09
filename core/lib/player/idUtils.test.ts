import { test, expect } from 'vitest';
import * as idUtils from './idUtils';
import { shortenId } from '@shared/utils';
import consts from '@shared/consts';


test('parsePlayerId', () => {
    let result = idUtils.parsePlayerId('IRFIVE:555555');
    expect(result.isIdValid).toBe(true);
    expect(result.idType).toBe('irfive');
    expect(result.idValue).toBe('555555');
    expect(result.idlowerCased).toBe('irfive:555555');

    result = idUtils.parsePlayerId('irfive:xxxxx');
    expect(result.isIdValid).toBe(false);
});

test('parsePlayerIds', () => {
    const result = idUtils.parsePlayerIds(['irfive:555555', 'irfive:xxxxx']);
    expect(result.validIdsArray).toEqual(['irfive:555555']);
    expect(result.invalidIdsArray).toEqual(['irfive:xxxxx']);
    expect(result.validIdsObject?.irfive).toBe('555555');
});

test('filterPlayerHwids accepts IRFive and legacy tokens without changing their case', () => {
    const legacy = '5:' + 'a'.repeat(64);
    const irfive = 'MixedCaseToken123456789';
    const result = idUtils.filterPlayerHwids([legacy, irfive, 'invalid!', 'short']);
    expect(result.validHwidsArray).toEqual([legacy, irfive]);
    expect(result.invalidHwidsArray).toEqual(['invalid!', 'short']);
});

test('parseLaxIdsArrayInput', () => {
    const result = idUtils.parseLaxIdsArrayInput('55555555000000009999, steam:1100001ffffffff, invalid');
    expect(result.validIds).toEqual(['discord:55555555000000009999', 'steam:1100001ffffffff']);
    expect(result.invalids).toEqual(['invalid']);
});

test('getIdFromOauthNameid', () => {
    expect(idUtils.getIdFromOauthNameid('/user/555555')).toBe('irfive:555555');
    expect(idUtils.getIdFromOauthNameid('https://forum.irfive.ir/internal/user/555555')).toBe('irfive:555555');
    expect(idUtils.getIdFromOauthNameid('https://forum.cfx.re/internal/user/555555')).toBe(false);
    expect(idUtils.getIdFromOauthNameid('/user/123456789')).toBe(false);
    expect(idUtils.getIdFromOauthNameid('/user/555555/extra')).toBe(false);
    expect(idUtils.getIdFromOauthNameid('xxxxx')).toBe(false);
});

test('search parses custom HWIDs, explicit ambiguous tokens, both account namespaces, and raw licenses', () => {
    const legacy = '5:' + 'a'.repeat(64);
    const numericHwid = '65333333333335656363636';
    const result = idUtils.parseLaxIdsArrayInput(`IRFIVE:123, fivem:456, 789, ${numericHwid}, ${legacy}, hwid:12345678901234567, hwid:MixedCaseToken12345, ${'b'.repeat(40)}`);
    expect(result.invalids).toEqual([]);
    expect(result.validIds).toEqual(['irfive:123', 'fivem:456', 'irfive:789', `license:${'b'.repeat(40)}`]);
    expect(result.validHwids).toEqual([numericHwid, legacy, '12345678901234567', 'MixedCaseToken12345']);
});

test('full custom license identifiers are validated and normalized without admitting extra suffixes', () => {
    const result = idUtils.parsePlayerIds(['LICENSE:AbCdEf1234567890', 'license:short', 'irfive:123:456']);
    expect(result.validIdsArray).toEqual(['license:abcdef1234567890']);
    expect(result.validIdsObject.license).toBe('abcdef1234567890');
    expect(result.validIdsObject.irfive).toBe(null);
    expect(result.invalidIdsArray).toEqual(['license:short', 'irfive:123:456']);
});

test('server-key validation supports IRFive while rejecting whitespace and config injection', () => {
    expect(consts.regexSvLicenseIrFive.test('irfive_ExampleServerKey_123-abc')).toBe(true);
    expect(consts.regexSvLicenseIrFive.test('irfive_ExampleServerKey\nset steam_webApiKey stolen')).toBe(false);
    expect(consts.regexSvLicenseIrFive.test('irfive_')).toBe(false);
});

//NOTE: testing here because the @shared workspace has no tests
test('shortenId', () => {
    // Invalid parameters
    expect(() => shortenId(123 as any)).toThrow('id');
    expect(() => shortenId('discord:123456789', 2)).toThrow('numChars');
    expect(() => shortenId('discord:123456789', 'invalid' as any)).toThrow('numChars');
    
    // Invalid id formats
    expect(shortenId('invalidFormat')).toBe('invalidFormat');
    expect(shortenId(':1234567890123456')).toBe(':1234567890123456');
    expect(shortenId('discord:')).toBe('discord:');

    // Default behavior (numChars = 4)
    expect(shortenId('discord:383919883341266945')).toBe('discord:3839…6945');
    expect(shortenId('xbl:12345678901')).toBe('xbl:1234…8901');
    
    // Valid ID with length <= threshold (should not be shortened)
    expect(shortenId('fivem:1234567890')).toBe('fivem:1234567890');
    expect(shortenId('steam:1234')).toBe('steam:1234');
    
    // Custom numChars parameter
    expect(shortenId('discord:383919883341266945', 3)).toBe('discord:383…945');
    expect(shortenId('discord:383919883341266945', 5)).toBe('discord:38391…66945');
    expect(shortenId('discord:383919883341266945', 6)).toBe('discord:383919…266945');
    expect(shortenId('2:bea2ac491d849477e66957b515f4a555a222e2e25911788d13fd46e9fda240a9', 20)).toBe('2:bea2ac491d849477e669…788d13fd46e9fda240a9');
    
    // Edge case: exactly at threshold
    expect(shortenId('discord:12345678', 3)).toBe('discord:12345678'); // 8 chars = 3*2+2, should not shorten
    expect(shortenId('discord:123456789', 3)).toBe('discord:123…789'); // 9 chars > 3*2+2, should shorten
});
