import { test, expect, vi, beforeEach } from 'vitest';
import got from '@lib/got';
import { resolveAdminIdentity } from './resolveAdminIdentity';
vi.mock('@lib/got', () => ({ default: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

test('explicit IRFive and legacy Cfx identifiers remain separate and do not depend on remote APIs', async () => {
    expect(await resolveAdminIdentity(' IRFIVE:123 ')).toEqual({ id: 'irfive:123', identifier: 'irfive:123' });
    expect(await resolveAdminIdentity('fivem:123')).toEqual({ id: 'fivem:123', identifier: 'fivem:123' });
    expect(await resolveAdminIdentity('123')).toEqual({ id: 'irfive:123', identifier: 'irfive:123' });
    expect(await resolveAdminIdentity('')).toBe(false);
    expect(got).not.toHaveBeenCalled();
});
test('usernames are resolved through the IRFive forum and verified against its response', async () => {
    vi.mocked(got).mockReturnValue({ json: async () => ({ user: { id: 123, username: 'Horam' } }) } as any);
    expect(await resolveAdminIdentity('Horam')).toEqual({ id: 'Horam', identifier: 'irfive:123' });
    expect(got).toHaveBeenCalledWith('https://forum.irfive.ir/u/Horam.json', expect.objectContaining({ followRedirect: false }));
    vi.mocked(got).mockReturnValue({ json: async () => ({ user: { id: 123, username: 'SomeoneElse' } }) } as any);
    await expect(resolveAdminIdentity('Horam')).rejects.toThrow('Could not resolve');
});
test('failed lookups do not silently remove the existing provider', async () => {
    vi.mocked(got).mockReturnValue({ json: async () => { throw new Error('network unavailable'); } } as any);
    await expect(resolveAdminIdentity('Horam')).rejects.toThrow('Could not resolve');
    await expect(resolveAdminIdentity('irfive:123:456')).rejects.toThrow('Invalid IRFive');
    await expect(resolveAdminIdentity('https://evil.invalid/user')).rejects.toThrow('Invalid IRFive');
});
