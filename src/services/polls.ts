import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import type { Poll } from '../database/models/Poll.ts';

function clampLabel(label: string, max = 80) {
    if (label.length <= max) return label;
    return `${label.slice(0, max - 3)}...`;
}

export function buildPollEmbed(poll: Poll) {
    const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes.length, 0);
    const lines = poll.options.map((opt, index) => {
        const count = opt.votes.length;
        const percent = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
        return `${index + 1}. ${opt.label} — ${count} (${percent}%)`;
    });

    const embed = new EmbedBuilder()
        .setTitle(poll.question)
        .setDescription(lines.join('\n') || 'No votes yet.');

    if (poll.isClosed) {
        embed.setFooter({ text: 'Poll closed' });
    } else if (poll.endsAt) {
        const ends = Math.floor(new Date(poll.endsAt).getTime() / 1000);
        embed.setFooter({ text: `Ends <t:${ends}:R>` });
    } else {
        embed.setFooter({ text: 'Vote below' });
    }

    return embed;
}

export function buildPollComponents(poll: Poll) {
    const now = Date.now();
    const disabled = poll.isClosed || (poll.endsAt ? poll.endsAt.getTime() <= now : false);

    if (poll.options.length <= 5) {
        const row = new ActionRowBuilder<ButtonBuilder>();
        for (const option of poll.options) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`poll:${poll._id}:${option.optionId}`)
                    .setLabel(clampLabel(option.label))
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled)
            );
        }
        return [row];
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId(`poll:${poll._id}`)
        .setPlaceholder('Select an option')
        .setMinValues(1)
        .setMaxValues(1)
        .setDisabled(disabled)
        .addOptions(
            poll.options.map((opt) => ({
                label: clampLabel(opt.label),
                value: opt.optionId,
            }))
        );

    return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)];
}
