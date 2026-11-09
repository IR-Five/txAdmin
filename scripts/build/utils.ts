import fs from 'node:fs';
import path from 'node:path';
import { SemVer } from 'semver';
import config from './config';
import { execFileSync } from 'node:child_process';


/**
 * txAdmin in ASCII
 */
export const txAdminASCII = () => {
    //NOTE: precalculating the ascii art for efficiency
    // const figlet = require('figlet');
    // let ascii = figlet.textSync('txAdmin');
    // let b64 = Buffer.from(ascii).toString('base64');
    // console.log(b64);
    const preCalculated = `ICBfICAgICAgICAgICAgXyAgICAgICBfICAgICAgICAgICBfICAgICAgIAogfCB8X19fICBfX
 yAgIC8gXCAgIF9ffCB8XyBfXyBfX18gKF8pXyBfXyAgCiB8IF9fXCBcLyAvICAvIF8gXCAvIF9gIHwgJ18gYCBfIFx8IHwg
 J18gXCAKIHwgfF8gPiAgPCAgLyBfX18gXCAoX3wgfCB8IHwgfCB8IHwgfCB8IHwgfAogIFxfXy9fL1xfXC9fLyAgIFxfXF9
 fLF98X3wgfF98IHxffF98X3wgfF98CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA=`;
    return Buffer.from(preCalculated, 'base64').toString('ascii');
};


/**
 * txAdmin + license banner for bundled files
 */
export const licenseBanner = (baseDir = '.', isBundledFile = false) => {
    const licensePath = path.join(baseDir, 'LICENSE');
    const rootPrefix = isBundledFile ? '../' : '';
    const lineSep = '%'.repeat(80);
    const logoPad = ' '.repeat(18);
    const contentLines = [
        lineSep,
        ...txAdminASCII().split('\n').map((x) => logoPad + x),
        lineSep,
        'Author: André Tabarra (https://github.com/tabarra)',
        'Repository: https://github.com/tabarra/txAdmin',
        'txAdmin is a free open source software provided under the license below.',
        lineSep,
        ...fs.readFileSync(licensePath, 'utf8').trim().split('\n'),
        lineSep,
        'This distribution also includes third party code under their own licenses, which',
        `can be found in ${rootPrefix}THIRD-PARTY-LICENSES.txt or their respective repositories.`,
        `Attribution for non-code assets can be found at the bottom of ${rootPrefix}README.md or at`,
        'the top of the respective file.',
        lineSep,
    ];
    if (isBundledFile) {
        const flattened = contentLines.join('\n * ');
        return `/*!\n * ${flattened}\n */`;
    } else {
        return contentLines.join('\n');
    }
};


/**
 * Processes a fxserver path to validate it as well as the monitor folder.
 * NOTE: this function is windows only, but could be easily adapted.
 */
export const getFxsPaths = (fxserverPath: string) => {
    const root = path.normalize(fxserverPath);

    //Process fxserver path
    const bin = path.join(root, 'FXServer.exe');
    const binStat = fs.statSync(bin);
    if (!binStat.isFile()) {
        throw new Error(`${bin} is not a file.`);
    }

    //Process monitor path
    const monitor = path.join(root, 'citizen', 'system_resources', 'monitor');
    const monitorStat = fs.statSync(monitor);
    if (!monitorStat.isDirectory()) {
        throw new Error(`${monitor} is not a directory.`);
    }

    return { root, bin, monitor };
};


/** Resolve an explicit version, tagged CI ref, or a reachable local version tag. */
export const getPublishVersion = (isOptional: boolean, explicitTag?: string) => {
    const workflowRef = process.env.GITHUB_REF;
    let version = explicitTag ?? process.env.TXADMIN_BUILD_VERSION;
    if (version === undefined && workflowRef?.startsWith('refs/tags/')) version = workflowRef;
    if (version === undefined && isOptional) {
        return { txVersion: '9.9.9-dev', isPreRelease: false, preReleaseExpiration: '0' };
    }
    if (version === undefined) {
        try {
            version = execFileSync('git', ['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*', 'HEAD'], {
                encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'],
            }).trim();
        } catch {
            throw new Error('Version setup failed: set TXADMIN_BUILD_VERSION=vX.Y.Z or fetch upstream version tags.');
        }
    }
    const normalized = version.replace(/^(?:refs\/tags\/)?v?/, '');
    let parsed: SemVer;
    try { parsed = new SemVer(normalized); }
    catch { throw new Error('Version setup failed: expected a semantic version such as v8.1.2.'); }
    const isPreRelease = parsed.prerelease.length > 0;
    const expiration = Date.now() + config.preReleaseExpirationDays * 86400000;
    console.log(`txAdmin version ${parsed.version}.`);
    return {
        txVersion: parsed.version, isPreRelease,
        preReleaseExpiration: isPreRelease ? expiration.toString() : '0',
    };
};


/**
 * Edits the ./dist/fxmanifest.lua to include the txAdmin version.
 * TODO: set up *_scripts automagically
 */
const setupDistFxmanifest = (targetPath: string, txVersion: string) => {
    // console.log('[BUILDER] Setting up fxmanifest.lua: ' + txVersion);
    const fxManifestPath = path.join(targetPath, 'fxmanifest.lua');
    let fxManifestContent = fs.readFileSync(fxManifestPath, 'utf8');
    fxManifestContent = fxManifestContent.replace(/^version 'REPLACE-VERSION'$/m, `version '${txVersion}'`);
    fs.writeFileSync(fxManifestPath, fxManifestContent);
};


/**
 * Sync the files from local path to target path.
 * This function tried to remove the files before copying new ones,
 * therefore, first make sure the path is correct.
 * NOTE: each change, it resets the entire target path.
 */
export const copyStaticFiles = (targetPath: string, txVersion: string, eventName: string) => {
    console.log(`[COPIER][${eventName}] Syncing ${targetPath}.`);
    for (const srcPath of config.copy) {
        const destPath = path.join(targetPath, srcPath);
        fs.rmSync(destPath, { recursive: true, force: true });
        fs.cpSync(srcPath, destPath, { recursive: true });
    }
    setupDistFxmanifest(targetPath, txVersion);
};
