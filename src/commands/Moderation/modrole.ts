import { BaseCommand } from '../../structures/Command.ts';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import { ensureGuildConfig } from '../../database/guildConfig.ts';

export default class ModRoleCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('modrole')
                .setDescription('Manage the moderator role that bypasses automod')
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
                .addSubcommand((sub) =>
                    sub
                        .setName('set')
                        .setDescription('Set the moderator role')
                        .addRoleOption((opt) =>
                            opt.setName('role').setDescription('Role to set as mod role').setRequired(true)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('clear')
                        .setDescription('Remove the moderator role')
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('view')
                        .setDescription('View the current moderator role')
                )
        );
    }

    public override async execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
        if (!interaction.inGuild()) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
            return;
        }

        const config = await ensureGuildConfig(interaction.guildId);
        const sub = interaction.options.getSubcommand();

        if (sub === 'set') {
            const role = interaction.options.getRole('role', true);
            config.modRoleId = role.id;
            await config.save();

            const embed = new EmbedBuilder()
                .setTitle('Mod Role Updated')
                .setColor(0x3498db)
                .setDescription(`Moderator role set to <@&${role.id}>.\nMembers with this role will bypass automod filters.`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        if (sub === 'clear') {
            config.modRoleId = null;
            await config.save();

            await interaction.reply({ content: 'Mod role cleared. Only the `Manage Messages` permission will bypass automod.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (sub === 'view') {
            const roleId = config.modRoleId;
            const label = roleId ? `<@&${roleId}>` : 'Not set (defaults to Manage Messages permission)';

            const embed = new EmbedBuilder()
                .setTitle('Mod Role')
                .setColor(0x3498db)
                .setDescription(`Current mod role: ${label}`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    }
}
