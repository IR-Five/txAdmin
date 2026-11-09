const modulename = 'WebServer:AuthChangeIdentifiers';
import { AuthedCtx } from '@modules/WebServer/ctxTypes';
import consoleFactory from '@lib/console';
import consts from '@shared/consts';
import { GenericApiResp } from '@shared/genericApiTypes';
import { z } from 'zod';
import { resolveAdminIdentity, type AdminIdentity } from '@lib/player/resolveAdminIdentity';
const console = consoleFactory(modulename);

//Helpers 
type ProviderDataType = AdminIdentity;

const bodySchema = z.object({
    cfxreId: z.string().trim(),
    discordId: z.string().trim(),
});
export type ApiChangeIdentifiersReqSchema = z.infer<typeof bodySchema>;

/**
 * Route to change your own identifiers
 */
export default async function AuthChangeIdentifiers(ctx: AuthedCtx) {
    //Sanity check
    const schemaRes = bodySchema.safeParse(ctx.request.body);
    if (!schemaRes.success) {
        return ctx.send<GenericApiResp>({
            error: `Invalid request body: ${schemaRes.error.message}`,
        });
    }
    const { cfxreId, discordId } = schemaRes.data;

    let citizenfxData: ProviderDataType | false;
    try {
        citizenfxData = await resolveAdminIdentity(cfxreId);
    } catch (error) {
        return ctx.send<GenericApiResp>({ error: (error as Error).message });
    }

    //Validate Discord ID
    let discordData: ProviderDataType | false = false;
    if (discordId.length) {
        if (!consts.validIdentifiers.discord.test(discordId)) {
            return ctx.send<GenericApiResp>({
                error: `The Discord ID needs to be the numeric "User ID" instead of the username.\n You can also leave it blank.`,
            });
        }
        discordData = {
            id: discordId.substring(8),
            identifier: discordId,
        };
    }

    //Get vault admin
    const vaultAdmin = txCore.adminStore.getAdminByName(ctx.admin.name);
    if (!vaultAdmin) throw new Error('Wait, what? Where is that admin?');

    //Prepare log message
    const changes: string[] = [];
    const oldCfx = vaultAdmin.providers.citizenfx?.identifier;
    const newCfx = citizenfxData ? citizenfxData.identifier : undefined;
    if (oldCfx !== newCfx) {
        if (!oldCfx && newCfx) {
            changes.push(`added ${newCfx}`);
        } else if (oldCfx && !newCfx) {
            changes.push(`removed ${oldCfx}`);
        } else if (oldCfx && newCfx) {
            changes.push(`changed ${oldCfx} → ${newCfx}`);
        }
    }

    const oldDiscord = vaultAdmin.providers.discord?.identifier;
    const newDiscord = discordData ? discordData.identifier : undefined;
    if (oldDiscord !== newDiscord) {
        if (!oldDiscord && newDiscord) {
            changes.push(`added ${newDiscord}`);
        } else if (oldDiscord && !newDiscord) {
            changes.push(`removed ${oldDiscord}`);
        } else if (oldDiscord && newDiscord) {
            changes.push(`changed ${oldDiscord} → ${newDiscord}`);
        }
    }

    const logMessage = changes.length
        ? `Modified own identifiers: ${changes.join(', ')}`
        : 'Modified own identifiers: No changes detected.';

    //Edit admin and give output
    try {
        await txCore.adminStore.editAdmin(ctx.admin.name, null, citizenfxData, discordData);

        ctx.admin.logAction(logMessage);
        return ctx.send<GenericApiResp>({ success: true });
    } catch (error) {
        return ctx.send<GenericApiResp>({ error: (error as Error).message });
    }
};
