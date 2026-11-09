import { test, expect, vi, afterEach } from 'vitest';
import AdminStore from '@modules/AdminStore/index.js';
import PlayerCheckJoin from '@routes/player/checkJoin';
import AdminManagerActions from '@routes/adminManager/actions';
import AuthChangeIdentifiers from '@routes/authentication/changeIdentifiers';
import PlayersDao from '@modules/Database/dao/players';
// These route/DAO tests exercise an in-memory chain, not database startup or migrations.
vi.mock('@modules/Database/instance', () => ({ SavePriority: { LOW: 1, HIGH: 2 } }));

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const provider = (identifier: string) => ({ id: identifier, identifier, data: {} });
function storeFixture() {
    const store = Object.create(AdminStore.prototype);
    store.admins = [
        { name: 'Owner', master: true, providers: { citizenfx: provider('irfive:123') }, permissions: [] },
        { name: 'Helper', master: false, providers: { discord: provider('discord:12345678901234567') }, permissions: [] },
    ];
    store.writeAdminsFile = vi.fn().mockResolvedValue(true);
    store.refreshOnlineAdmins = vi.fn().mockResolvedValue(undefined);
    return store;
}

test('add/edit/self-service cannot reuse another admin identity, while namespaces stay distinct', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('GetPasswordHash', () => 'test-hash');
    const store = storeFixture();
    await expect(store.addAdmin('Attacker', provider('irfive:123'), false, 'password', [])).rejects.toThrow('already linked');
    await expect(store.editAdmin('Helper', null, provider('irfive:123'), false)).rejects.toThrow('already linked');
    expect(store.admins[1].providers.citizenfx).toBeUndefined();
    await expect(store.addAdmin('Legacy', provider('fivem:123'), false, 'password', [])).resolves.toBe(true);
    expect(store.getAdminByIdentifiers(['irfive:123']).name).toBe('Owner');
    expect(store.getAdminByIdentifiers(['fivem:123']).name).toBe('Legacy');
});

test('admin-only mode admits a linked IRFive-only admin and denies an unlinked IRFive player', async () => {
    const store = storeFixture();
    vi.stubGlobal('txConfig', { banlist: { enabled: false }, whitelist: { mode: 'adminOnly' } });
    vi.stubGlobal('txCore', {
        adminStore: store, translator: { t: (key: string) => key },
        metrics: { txRuntime: { whitelistCheckTime: { count: vi.fn() } } },
    });
    const ctx = (id: string) => ({ request: { body: { playerName: 'Test', playerIds: [id], playerHwids: [] } }, send: (data: any) => data });
    expect(await PlayerCheckJoin(ctx('irfive:123') as any)).toEqual({ allow: true });
    expect(await PlayerCheckJoin(ctx('irfive:456') as any)).toMatchObject({ allow: false });
});

test('admin manager and own-account routes accept the same explicit IRFive identity', async () => {
    const store = storeFixture();
    store.addAdmin = vi.fn().mockResolvedValue(true);
    store.editAdmin = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('txCore', { adminStore: store });
    const admin = { name: 'Owner', isMaster: true, permissions: [], testPermission: () => true, logAction: vi.fn() };
    const base = { admin, send: (data: any) => data, utils: { error: vi.fn() } };
    const added = await AdminManagerActions({ ...base, params: { action: 'add' }, request: { body: {
        name: 'NewAdmin', citizenfxID: 'irfive:456', discordID: '', permissions: [],
    } } } as any);
    expect(added).toMatchObject({ type: 'showPassword' });
    expect(store.addAdmin.mock.calls[0][1].identifier).toBe('irfive:456');
    expect(await AuthChangeIdentifiers({ ...base, request: { body: { cfxreId: 'irfive:123', discordId: '' } } } as any)).toEqual({ success: true });
    expect(store.editAdmin.mock.calls[0][2].identifier).toBe('irfive:123');
});

test('database license validation accepts custom values but rejects malformed references before querying', () => {
    const value = { license: 'CustomLicense123456' };
    const chain = { get: vi.fn().mockReturnThis(), find: vi.fn().mockReturnThis(), cloneDeep: vi.fn().mockReturnThis(), value: () => value };
    const dao = new PlayersDao({ isReady: true, obj: { chain } } as any);
    expect(dao.findOne(value.license)).toEqual(value);
    expect(chain.find).toHaveBeenCalledWith({ license: value.license });
    expect(() => dao.findOne('license:CustomLicense123456')).toThrow('Invalid reference type');
    expect(() => dao.findOne('bad\nreference')).toThrow('Invalid reference type');
});
