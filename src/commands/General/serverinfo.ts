import { BaseCommand } from '../../structures/Command.ts';
import { ChannelType, EmbedBuilder, GuildVerificationLevel, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';

const VERIFICATION_LABELS: Record<number, string> = {
    [GuildVerificationLevel.None]: 'None',
    [GuildVerificationLevel.Low]: 'Low',
    [GuildVerificationLevel.Medium]: 'Medium',
    [GuildVerificationLevel.High]: 'High',
    [GuildVerificationLevel.VeryHigh]: 'Very High',
};

export default class ServerInfoCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('serverinfo')
                .setDescription('View information about this server')
        );
    }

    public override async execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
        if (!interaction.inGuild() || !interaction.guild) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
            return;
        }

        const guild = interaction.guild;

        const textChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size;
        const voiceChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).size;
        const categories = guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).size;
        const threads = guild.channels.cache.filter(
            (c) => c.type === ChannelType.PublicThread || c.type === ChannelType.PrivateThread
        ).size;

        const embed = new EmbedBuilder()
            .setTitle(guild.name)
            .setThumbnail(guild.iconURL({ size: 256 }))
            .setColor(0x3498db)
            .addFields(
                { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
                { name: 'ID', value: guild.id, inline: true },
                { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                { name: 'Members', value: `${guild.memberCount}`, inline: true },
                { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true },
                { name: 'Emojis', value: `${guild.emojis.cache.size}`, inline: true },
                {
                    name: 'Channels',
                    value: `Text: ${textChannels} | Voice: ${voiceChannels} | Categories: ${categories} | Threads: ${threads}`,
                },
                { name: 'Verification', value: VERIFICATION_LABELS[guild.verificationLevel] ?? 'Unknown', inline: true },
                { name: 'Boost Level', value: `Tier ${guild.premiumTier}`, inline: true },
                { name: 'Boosts', value: `${guild.premiumSubscriptionCount ?? 0}`, inline: true }
            )
            .setTimestamp();

        if (guild.bannerURL()) {
            embed.setImage(guild.bannerURL({ size: 512 }));
        }

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
}
