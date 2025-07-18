//All uppercase and [0,I,O] removed
const actionIdAlphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZ';

const regexDiscordSnowflake = /^\d{17,20}$/;

export default {
    //Identifier stuff
    regexValidHwidToken: /^[a-zA-Z0-9]{10,150}$/,
    validIdentifiers: {
        // https://github.com/discordjs/discord.js/pull/9144
        // validated in txtracker dataset
        discord: /^discord:\d{17,20}$/,
        fivem: /^fivem:\d{1,8}$/,
        irfive: /^irfive:\d{1,8}$/i,
        license: /^license:[a-zA-Z0-9]{14,60}$/,   // ← تغییر دادیم
        license2: /^license2:[a-zA-Z0-9]{14,60}$/, // ← تغییر دادیم
        live: /^live:\d{14,20}$/,
        steam: /^steam:1100001[0-9A-Fa-f]{8}$/,
        xbl: /^xbl:\d{14,20}$/,
    },
    validIdentifierParts: {
        discord: regexDiscordSnowflake,
        fivem: /^fivem:\d{1,8}$/,
        irfive: /^irfive:\d{1,8}$/i,
        license: /^license:[a-zA-Z0-9]{14,60}$/,   // ← تغییر دادیم
        license2: /^license2:[a-zA-Z0-9]{14,60}$/, // ← تغییر دادیم
        live: /^\d{14,20}$/,
        steam: /^1100001[0-9A-Fa-f]{8}$/,
        xbl: /^\d{14,20}$/,
    },

    // Database stuff
    adminPasswordMinLength: 6,
    adminPasswordMaxLength: 128,
    regexValidFivemUsername: /^\w[\w.-]{1,18}\w$/, //also cant have repeated non-alphanum chars
    regexActionID: new RegExp(`^[${actionIdAlphabet}]{4}-[${actionIdAlphabet}]{4}$`),
    regexWhitelistReqID: new RegExp(`R[${actionIdAlphabet}]{4}`),

    //Other stuff
    regexDiscordSnowflake,
    regexSvLicenseOld: /^\w{32}$/,
    regexSvLicenseNew: /^cfxk_\w{1,60}_\w{1,20}$/,
    regexValidIP: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
    actionIdAlphabet,
    nuiWebpipePath: 'https://monitor/WebPipe/',
    regexCustomThemeName: /^[a-z0-9]+(-[a-z0-9]+)*$/
} as const;
