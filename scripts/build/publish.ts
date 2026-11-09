import fs from 'node:fs';
import esbuild from 'esbuild';
import {
    copyStaticFiles,
    getPublishVersion,
    licenseBanner,
} from './utils';

// Optional CLI version overrides the environment; local builds can use a reachable Git tag.
const tagArgs = process.argv.slice(2).filter(arg => arg.startsWith('--tag='));
if (tagArgs.length > 1) throw new Error('Provide --tag only once.');
const explicitTag = tagArgs[0]?.slice('--tag='.length);
if (explicitTag !== undefined && !explicitTag) throw new Error('--tag must not be empty.');
const { txVersion, isPreRelease, preReleaseExpiration } = getPublishVersion(false, explicitTag);

fs.writeFileSync('.github/.cienv', `TX_IS_PRERELEASE=${isPreRelease}\n`);

console.log('Starting txAdmin Prod Builder');
copyStaticFiles('./dist/', txVersion, 'publish');

fs.writeFileSync('./dist/.yarn.installed', '');
fs.writeFileSync('./dist/package.json', '{"type":"commonjs"}');
fs.writeFileSync('./dist/LICENSE.txt', licenseBanner());

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
