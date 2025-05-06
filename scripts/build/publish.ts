import fs from 'node:fs';
import esbuild from 'esbuild';
import {
    copyStaticFiles,
    getPublishVersion,
    licenseBanner,
} from './utils';

// ───────────────────────────────────────────────────────────────
// STEP 1: Parse CLI arguments
const tagArg = process.argv.find(arg => arg.startsWith('--tag='));
if (!tagArg) {
    throw new Error('Version setup failed: No --tag found.');
}
const tag = tagArg.split('=')[1];

// ───────────────────────────────────────────────────────────────
// STEP 2: Detect version using the tag
const { txVersion, isPreRelease, preReleaseExpiration } = getPublishVersion(tag);

// ───────────────────────────────────────────────────────────────
// STEP 3: Write CI env file
fs.writeFileSync('.github/.cienv', `TX_IS_PRERELEASE=${isPreRelease}\n`);

// ───────────────────────────────────────────────────────────────
// STEP 4: Copy static files
console.log('Starting txAdmin Prod Builder');
copyStaticFiles('./dist/', txVersion, 'publish');

// ───────────────────────────────────────────────────────────────
// STEP 5: Create required metadata files
fs.writeFileSync('./dist/.yarn.installed', '');
fs.writeFileSync('./dist/package.json', '{"type":"commonjs"}');
fs.writeFileSync('./dist/LICENSE.txt', licenseBanner());

// ───────────────────────────────────────────────────────────────
// STEP 6: Transpile & bundle core
try {
    const { errors } = esbuild.buildSync({
        entryPoints: ['./core'],
        bundle: true,
        outfile: './dist/core/index.js',
        platform: 'node',
        target: 'node16',
        format: 'cjs',
        minifyWhitespace: true,
        charset: 'utf8',
        define: {
            TX_PRERELEASE_EXPIRATION: preReleaseExpiration,
        },
        banner: {
            js: licenseBanner(undefined, true),
        },
        legalComments: 'none',
    });

    if (errors.length) {
        console.error(`[BUNDLER] Failed with ${errors.length} errors.`);
        process.exit(1);
    }
} catch (error) {
    console.error('[BUNDLER] Errored out :(');
    console.dir(error);
    process.exit(1);
}

console.log('Publish task finished :)');
