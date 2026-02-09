import { BaseCommand } from '../../structures/Command.ts';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder, ChannelType } from 'discord.js';
import type { ChatInputCommandInteraction, Client, TextChannel } from 'discord.js';

const SLOWMODE_CHOICES = [
    { name: 'Off', value: 0 },
    { name: '5 seconds', value: 5 },
    { name: '10 seconds', value: 10 },
    { name: '15 seconds', value: 15 },
    { name: '30 seconds', value: 30 },
    { name: '1 minute', value: 60 },
    { name: '2 minutes', value: 120 },
    { name: '5 minutes', value: 300 },
    { name: '10 minutes', value: 600 },
    { name: '15 minutes', value: 900 },
    { name: '30 minutes', value: 1800 },
    { name: '1 hour', value: 3600 },
    { name: '2 hours', value: 7200 },
    { name: '6 hours', value: 21600 },
];

export default class SlowmodeCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('slowmode')
                .setDescription('Set slowmode for a channel')
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
                .addIntegerOption((opt) =>
                    opt
                        .setName('duration')
                        .setDescription('Slowmode duration (0 to disable)')
                        .setRequired(true)
                        .addChoices(...SLOWMODE_CHOICES)
                )
                .addChannelOption((opt) =>
                    opt
                        .setName('channel')
                        .setDescription('Channel to set slowmode on (defaults to current)')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildForum)
                        .setRequired(false)
                )
        );
    }

    public override async execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
        if (!interaction.inGuild()) {
            await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
            return;
        }

        const duration = interaction.options.getInteger('duration', true);
        const targetChannel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;

        if (!targetChannel || !('setRateLimitPerUser' in targetChannel)) {
            await interaction.reply({ content: 'Invalid channel.', flags: MessageFlags.Ephemeral });
            return;
        }

        await targetChannel.setRateLimitPerUser(duration, `Set by ${interaction.user.tag}`);

        const label = duration === 0
            ? 'Slowmode disabled'
            : `Slowmode set to ${SLOWMODE_CHOICES.find((c) => c.value === duration)?.name ?? `${duration}s`}`;

        const embed = new EmbedBuilder()
            .setTitle('Slowmode Updated')
            .setColor(duration === 0 ? 0x2ecc71 : 0x3498db)
            .setDescription(`${targetChannel}: ${label}`)
            .addFields({ name: 'Moderator', value: `${interaction.user.tag}`, inline: true })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
}
