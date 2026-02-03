import { BaseInteraction } from '../../structures/Interaction.ts';
import type { AnySelectMenuInteraction, ButtonInteraction, Client } from 'discord.js';
import ReactionRolePanelModel from '../../database/models/ReactionRolePanel.ts';
import { PermissionFlagsBits } from 'discord.js';

function extractIds(customId: string) {
    const parts = customId.split(':');
    return {
        panelId: parts[1],
        roleId: parts[2],
    };
}

export default class ReactionRolesInteraction extends BaseInteraction {
    constructor() {
        super('reactionroles', 'button');
    }

    public override async execute(
        interaction: ButtonInteraction | AnySelectMenuInteraction,
        client: Client
    ): Promise<void> {
        if (!interaction.inGuild()) return;

        const { panelId, roleId } = extractIds(interaction.customId);
        if (!panelId) return;

        const panel = await ReactionRolePanelModel.findById(panelId);
        if (!panel || !panel.isActive) return;

        const member =
            interaction.guild?.members.cache.get(interaction.user.id) ??
            (await interaction.guild?.members.fetch(interaction.user.id).catch(() => null));
        if (!member) return;

        const botMember = interaction.guild?.members.me;
        if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
            await interaction.reply({ content: 'I need Manage Roles to do that.', ephemeral: true });
            return;
        }

        const panelRoleIds = panel.items.map((item) => item.roleId);

        if (interaction.isAnySelectMenu()) {
            const selected = new Set(interaction.values);
            const toAdd = panelRoleIds.filter((id) => selected.has(id));
            const toRemove = panelRoleIds.filter((id) => !selected.has(id));

            const manageableAdd = toAdd.filter((id) => {
                const role = interaction.guild?.roles.cache.get(id);
                return role ? role.position < botMember.roles.highest.position : false;
            });
            const manageableRemove = toRemove.filter((id) => {
                const role = interaction.guild?.roles.cache.get(id);
                return role ? role.position < botMember.roles.highest.position : false;
            });

            try {
                if (manageableAdd.length) {
                    await member.roles.add(manageableAdd);
                }
                if (manageableRemove.length) {
                    await member.roles.remove(manageableRemove);
                }
            } catch (error) {
                console.error('Failed to update roles from reaction roles select:', error);
            }

            await interaction.deferUpdate();
            return;
        }

        if (!roleId) return;

        const role = interaction.guild?.roles.cache.get(roleId);
        if (!role || role.position >= botMember.roles.highest.position) {
            await interaction.reply({ content: 'I cannot manage that role.', ephemeral: true });
            return;
        }

        const hasRole = member.roles.cache.has(roleId);
        try {
            if (hasRole) {
                await member.roles.remove(roleId);
            } else {
                await member.roles.add(roleId);
            }
        } catch (error) {
            console.error('Failed to update role from reaction roles button:', error);
        }

        await interaction.deferUpdate();
    }
}
