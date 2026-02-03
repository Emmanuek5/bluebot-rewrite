import { BaseInteraction } from '../../structures/Interaction.ts';
import { ComponentHelper } from '../../structures/Component.ts';
import {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
} from 'discord.js';
import type {
    AnySelectMenuInteraction,
    ButtonInteraction,
    Client,
    ModalSubmitInteraction,
} from 'discord.js';
import { ensureGuildConfig } from '../../database/guildConfig.ts';
import { buildSetupPanel, type SetupPage } from '../../panels/setupPanel.ts';
import { DEFAULT_ESCALATION } from '../../moderation/escalation.ts';

function parseList(input: string) {
    return input
        .split(/[\n,]/g)
        .map((value) => value.trim())
        .filter(Boolean);
}

function modalForList(customId: string, title: string, label: string, placeholder: string) {
    const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
    const input = new TextInputBuilder()
        .setCustomId('list')
        .setLabel(label)
        .setPlaceholder(placeholder)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    modal.addComponents(row);
    return modal;
}

export default class SetupPanelInteraction extends BaseInteraction {
    constructor() {
        super('setup', 'button');
    }

    public override async execute(
        interaction: ButtonInteraction | ModalSubmitInteraction | AnySelectMenuInteraction,
        client: Client
    ): Promise<void> {
        if (!interaction.inGuild()) return;
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({ content: 'You need Manage Server to use this panel.', ephemeral: true });
            return;
        }

        const config = await ensureGuildConfig(interaction.guildId);
        const guildName = interaction.guild?.name ?? 'Server';
        const channelId = interaction.channelId;

        if (interaction.isModalSubmit()) {
            const id = interaction.customId;
            const value = interaction.fields.getTextInputValue('list');
            const list = parseList(value);

            if (id === 'setup:modal:swears') {
                config.moderation.swears.words = list;
                config.moderation.swears.enabled = list.length > 0;
            } else if (id === 'setup:modal:banned') {
                config.moderation.bannedWords.words = list;
                config.moderation.bannedWords.enabled = list.length > 0;
            } else if (id === 'setup:modal:regex') {
                config.moderation.regexFilters.patterns = list;
                config.moderation.regexFilters.enabled = list.length > 0;
            } else if (id === 'setup:modal:sticky') {
                const existing = config.stickyMessages.find(
                    (entry) => entry.channelId === channelId
                );
                if (existing) {
                    existing.content = value.trim();
                    existing.enabled = true;
                    existing.lastMessageId = null;
                    existing.interval = existing.interval ?? 5;
                } else {
                    config.stickyMessages.push({
                        channelId,
                        content: value.trim(),
                        enabled: true,
                        interval: 5,
                        lastMessageId: null,
                    });
                }
            } else if (id === 'setup:modal:stickyInterval') {
                const interval = Number.parseInt(value.trim(), 10);
                if (!Number.isFinite(interval) || interval < 1 || interval > 100) {
                    await interaction.reply({
                        content: 'Interval must be a number between 1 and 100.',
                        ephemeral: true,
                    });
                    return;
                }
                const existing = config.stickyMessages.find(
                    (entry) => entry.channelId === channelId
                );
                if (!existing) {
                    await interaction.reply({
                        content: 'Set a sticky message for this channel first.',
                        ephemeral: true,
                    });
                    return;
                }
                existing.interval = interval;
            }

            await config.save();
            const page: SetupPage =
                id === 'setup:modal:sticky' || id === 'setup:modal:stickyInterval'
                    ? 'sticky'
                    : 'filters';
            const panel = buildSetupPanel(page, config, guildName, channelId);

            await interaction.deferUpdate();
            if (interaction.message) {
                await interaction.message.edit(panel);
            } else {
                await interaction.editReply(panel);
            }
            return;
        }

        if (interaction.isAnySelectMenu()) {
            const id = interaction.customId;
            if (id === 'setup:log:channel') {
                const channel = interaction.values[0];
                config.logging.modLogChannelId = channel ?? null;
                await config.save();
                return interaction.update(buildSetupPanel('logging', config, guildName, channelId));
            }

            if (id === 'setup:roles:select') {
                config.autoRoles.roleIds = interaction.values;
                config.autoRoles.enabled = interaction.values.length > 0;
                await config.save();
                return interaction.update(buildSetupPanel('roles', config, guildName, channelId));
            }
        }

        if (interaction.isButton()) {
            const [_, action, target] = interaction.customId.split(':');

            if (interaction.customId === 'setup:home') {
                return interaction.update(buildSetupPanel('home', config, guildName, channelId));
            }

            if (action === 'group') {
                return interaction.update(
                    buildSetupPanel(target as SetupPage, config, guildName, channelId)
                );
            }

            if (action === 'toggle') {
                if (target === 'swears') {
                    config.moderation.swears.enabled = !config.moderation.swears.enabled;
                } else if (target === 'banned') {
                    config.moderation.bannedWords.enabled = !config.moderation.bannedWords.enabled;
                } else if (target === 'regex') {
                    config.moderation.regexFilters.enabled = !config.moderation.regexFilters.enabled;
                } else if (target === 'caps') {
                    config.moderation.caps.enabled = !config.moderation.caps.enabled;
                } else if (target === 'mentions') {
                    config.moderation.mentions.enabled = !config.moderation.mentions.enabled;
                } else if (target === 'bypassStaff') {
                    config.moderation.bypassStaff = !config.moderation.bypassStaff;
                } else if (target === 'timeouts') {
                    if (!config.moderation.escalation) {
                        config.moderation.escalation = {
                            ...DEFAULT_ESCALATION,
                            enabled: !DEFAULT_ESCALATION.enabled,
                        };
                    } else {
                        config.moderation.escalation.enabled = !config.moderation.escalation.enabled;
                    }
                }

                await config.save();
                return interaction.update(buildSetupPanel('filters', config, guildName, channelId));
            }

            if (action === 'clear') {
                if (target === 'swears') {
                    config.moderation.swears.words = [];
                    config.moderation.swears.enabled = false;
                } else if (target === 'banned') {
                    config.moderation.bannedWords.words = [];
                    config.moderation.bannedWords.enabled = false;
                } else if (target === 'regex') {
                    config.moderation.regexFilters.patterns = [];
                    config.moderation.regexFilters.enabled = false;
                }

                await config.save();
                return interaction.update(buildSetupPanel('filters', config, guildName, channelId));
            }

            if (action === 'modal') {
                if (target === 'swears') {
                    return interaction.showModal(
                        modalForList(
                            'setup:modal:swears',
                            'Set Custom Swear Words',
                            'Custom words (comma or new line)',
                            'word1, word2, word3'
                        )
                    );
                }
                if (target === 'banned') {
                    return interaction.showModal(
                        modalForList(
                            'setup:modal:banned',
                            'Set Banned Words',
                            'Words (comma or new line)',
                            'word1, word2, word3'
                        )
                    );
                }
                if (target === 'regex') {
                    return interaction.showModal(
                        modalForList(
                            'setup:modal:regex',
                            'Set Regex Patterns',
                            'Patterns (comma or new line)',
                            '^badword$'
                        )
                    );
                }
                if (target === 'stickyInterval') {
                    const modal = new ModalBuilder()
                        .setCustomId('setup:modal:stickyInterval')
                        .setTitle('Set Sticky Interval');
                    const input = new TextInputBuilder()
                        .setCustomId('list')
                        .setLabel('Messages between sticky posts')
                        .setPlaceholder('5')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);
                    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
                    modal.addComponents(row);
                    return interaction.showModal(modal);
                }
            }

            if (interaction.customId === 'setup:sticky:set') {
                const modal = new ModalBuilder()
                    .setCustomId('setup:modal:sticky')
                    .setTitle('Set Sticky Message');
                const input = new TextInputBuilder()
                    .setCustomId('list')
                    .setLabel('Sticky message content')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);
                const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
                modal.addComponents(row);
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'setup:sticky:disable') {
                const existing = config.stickyMessages.find(
                    (entry) => entry.channelId === channelId
                );
                if (existing) {
                    existing.enabled = false;
                    existing.lastMessageId = null;
                }
                await config.save();
                return interaction.update(buildSetupPanel('sticky', config, guildName, channelId));
            }

            if (interaction.customId === 'setup:log:clear') {
                config.logging.modLogChannelId = null;
                await config.save();
                return interaction.update(buildSetupPanel('logging', config, guildName, channelId));
            }

            if (interaction.customId === 'setup:roles:toggle') {
                config.autoRoles.enabled = !config.autoRoles.enabled;
                await config.save();
                return interaction.update(buildSetupPanel('roles', config, guildName, channelId));
            }
        }
    }
}
