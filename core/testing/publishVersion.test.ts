import { test, expect, vi, afterEach } from 'vitest';
import { getPublishVersion } from '../../scripts/build/utils';
import { execFileSync } from 'node:child_process';
vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
test('CLI version overrides environment and CI versions without becoming a dev build', () => {
    vi.stubEnv('GITHUB_REF', 'refs/tags/v8.0.1');
    vi.stubEnv('TXADMIN_BUILD_VERSION', '8.0.2');
    expect(getPublishVersion(false, 'v8.1.2')).toMatchObject({ txVersion: '8.1.2', isPreRelease: false });
});
test('tagged CI and local environment versions are both supported', () => {
    vi.stubEnv('GITHUB_REF', 'refs/tags/v8.1.2');
    vi.stubEnv('TXADMIN_BUILD_VERSION', undefined);
    expect(getPublishVersion(false).txVersion).toBe('8.1.2');
    vi.stubEnv('TXADMIN_BUILD_VERSION', '8.2.0-beta.1');
    const result = getPublishVersion(false);
    expect(result.isPreRelease).toBe(true);
    expect(Number(result.preReleaseExpiration)).toBeGreaterThan(Date.now());
});
test('local release builds use a reachable version tag and dev builds retain the dev label', () => {
    vi.stubEnv('GITHUB_REF', undefined);
    vi.stubEnv('TXADMIN_BUILD_VERSION', undefined);
    vi.mocked(execFileSync).mockReturnValue('v8.1.2\n');
    expect(getPublishVersion(false).txVersion).toBe('8.1.2');
    expect(getPublishVersion(true).txVersion).toBe('9.9.9-dev');
    expect(() => getPublishVersion(false, 'not-a-version')).toThrow('semantic version');
});
