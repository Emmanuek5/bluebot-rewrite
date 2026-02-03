import { ComponentHelper } from '../structures/Component.ts';
import {
    ButtonStyle,
    ChannelType,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    SeparatorSpacingSize,
    ComponentType,
} from 'discord.js';
import type { InteractionReplyOptions } from 'discord.js';
import type { APIButtonComponent } from 'discord-api-types/v10';
import type { GuildConfig } from '../database/models/GuildConfig.ts';
import { DEFAULT_SWEAR_WORDS } from '../moderation/swearWords.ts';
import { DEFAULT_ESCALATION } from '../moderation/escalation.ts';

export type SetupPage = 'home' | 'filters' | 'sticky' | 'logging' | 'roles' | 'notes';
type SetupPanelPayload = InteractionReplyOptions;

function toggleLabel(label: string, enabled: boolean) {
    return `${label}: ${enabled ? 'On' : 'Off'}`;
}

function toggleStyle(enabled: boolean) {
    return enabled ? ButtonStyle.Success : ButtonStyle.Secondary;
}

function navStyle(active: SetupPage | null, target: SetupPage) {
    if (active === target) return ButtonStyle.Success;
    if (active === 'home') return ButtonStyle.Primary;
    return ButtonStyle.Secondary;
}

function accessoryButton(customId: string, label: string, style: ButtonStyle = ButtonStyle.Primary): APIButtonComponent {
    return {
        type: ComponentType.Button,
        style,
        custom_id: customId,
        label,
    };
}

function navRows(active: SetupPage = 'home') {
    const row1 = ComponentHelper.row(
        ComponentHelper.button({
            customId: 'setup:group:filters',
            label: 'Filters',
            style: navStyle(active, 'filters'),
        }),
        ComponentHelper.button({
            customId: 'setup:group:sticky',
            label: 'Sticky',
            style: navStyle(active, 'sticky'),
        }),
        ComponentHelper.button({
            customId: 'setup:group:logging',
            label: 'Logging',
            style: navStyle(active, 'logging'),
        })
    );

    const row2 = ComponentHelper.row(
        ComponentHelper.button({
            customId: 'setup:group:roles',
            label: 'Roles',
            style: navStyle(active, 'roles'),
        }),
        ComponentHelper.button({
            customId: 'setup:group:notes',
            label: 'Notes',
            style: navStyle(active, 'notes'),
        }),
        ComponentHelper.button({
            customId: 'setup:home',
            label: 'Home',
            style: ButtonStyle.Secondary,
        })
    );

    return [row1, row2];
}

function buildHome(config: GuildConfig, guildName: string): SetupPanelPayload {
    const summary = [
        `Swears: ${DEFAULT_SWEAR_WORDS.length + (config.moderation?.swears?.words.length ?? 0)}`,
        `Banned: ${config.moderation?.bannedWords?.words.length ?? 0}`,
        `Regex: ${config.moderation?.regexFilters?.patterns.length ?? 0}`,
        `Sticky: ${config.stickyMessages.filter((s) => s.enabled).length} channel(s)`,
        `Auto Roles: ${config.autoRoles?.roleIds.length ?? 0}`,
    ].join(' | ');

    return {
        components: [
            ComponentHelper.container((container) =>
                container
                    .setAccentColor(0x2b6cb0)
                    .addTextDisplayComponents(
                        ComponentHelper.textDisplay('# Setup Panel'),
                        ComponentHelper.textDisplay(`Server: ${guildName}`)
                    )
                    .addSeparatorComponents(
                        ComponentHelper.separator({ divider: true, spacing: SeparatorSpacingSize.Small })
                    )
                    .addTextDisplayComponents(
                        ComponentHelper.textDisplay(`Quick stats: ${summary}`),
                        ComponentHelper.textDisplay('Choose a section to configure:')
                    )
                    .addSectionComponents(
                        ComponentHelper.section((section) =>
                            section
                                .addTextDisplayComponents(
                                    ComponentHelper.textDisplay('**Filters**\nWords, regex, caps, mentions.')
                                )
                                .setButtonAccessory(accessoryButton('setup:group:filters', 'Open'))
                        ),
                        ComponentHelper.section((section) =>
                            section
                                .addTextDisplayComponents(
                                    ComponentHelper.textDisplay('**Sticky**\nPin a message every N posts.')
                                )
                                .setButtonAccessory(accessoryButton('setup:group:sticky', 'Open'))
                        ),
                        ComponentHelper.section((section) =>
                            section
                                .addTextDisplayComponents(
                                    ComponentHelper.textDisplay('**Logging**\nChoose a mod-log channel.')
                                )
                                .setButtonAccessory(accessoryButton('setup:group:logging', 'Open'))
                        ),
                        ComponentHelper.section((section) =>
                            section
                                .addTextDisplayComponents(
                                    ComponentHelper.textDisplay('**Roles**\nAuto-assign roles on join.')
                                )
                                .setButtonAccessory(accessoryButton('setup:group:roles', 'Open'))
                        ),
                        ComponentHelper.section((section) =>
                            section
                                .addTextDisplayComponents(
                                    ComponentHelper.textDisplay('**Notes**\nManage moderator notes.')
                                )
                                .setButtonAccessory(accessoryButton('setup:group:notes', 'Open'))
                        )
                    )
            ),
        ],
        flags: ComponentHelper.componentsV2Flag(),
    };
}

function buildFilters(config: GuildConfig): SetupPanelPayload {
    const wordsSummary = [
        `Swears: ${DEFAULT_SWEAR_WORDS.length} built-in + ${config.moderation?.swears?.words.length ?? 0} custom`,
        `Banned: ${config.moderation?.bannedWords?.words.length ?? 0}`,
        `Regex: ${config.moderation?.regexFilters?.patterns.length ?? 0}`,
    ].join(' | ');

    const escalation = config.moderation?.escalation ?? DEFAULT_ESCALATION;
    const settingsSummary = [
        `Caps ratio: ${config.moderation?.caps?.ratio ?? 0}`,
        `Min length: ${config.moderation?.caps?.minLength ?? 0}`,
        `Max mentions: ${config.moderation?.mentions?.max ?? 0}`,
        `Bypass staff: ${config.moderation?.bypassStaff ?? true ? 'On' : 'Off'}`,
        `Auto timeout: ${escalation.enabled ? 'On' : 'Off'} (${escalation.maxViolations} in ${escalation.windowMinutes}m -> ${escalation.timeoutMinutes}m)`,
    ].join(' | ');

    const toggleRow1 = ComponentHelper.row(
        ComponentHelper.button({
            customId: 'setup:toggle:swears',
            label: toggleLabel('Swears', config.moderation?.swears?.enabled ?? false),
            style: toggleStyle(config.moderation?.swears?.enabled ?? false),
        }),
        ComponentHelper.button({
            customId: 'setup:toggle:banned',
            label: toggleLabel('Banned', config.moderation?.bannedWords?.enabled ?? false),
            style: toggleStyle(config.moderation?.bannedWords?.enabled ?? false),
        }),
        ComponentHelper.button({
            customId: 'setup:toggle:regex',
            label: toggleLabel('Regex', config.moderation?.regexFilters?.enabled ?? false),
            style: toggleStyle(config.moderation?.regexFilters?.enabled ?? false),
        })
    );

    const toggleRow2 = ComponentHelper.row(
        ComponentHelper.button({
            customId: 'setup:toggle:caps',
            label: toggleLabel('Caps', config.moderation?.caps?.enabled ?? false),
            style: toggleStyle(config.moderation?.caps?.enabled ?? false),
        }),
        ComponentHelper.button({
            customId: 'setup:toggle:mentions',
            label: toggleLabel('Mentions', config.moderation?.mentions?.enabled ?? false),
            style: toggleStyle(config.moderation?.mentions?.enabled ?? false),
        }),
        ComponentHelper.button({
            customId: 'setup:toggle:bypassStaff',
            label: toggleLabel('Bypass Staff', config.moderation?.bypassStaff ?? true),
            style: toggleStyle(config.moderation?.bypassStaff ?? true),
        }),
        ComponentHelper.button({
            customId: 'setup:toggle:timeouts',
            label: toggleLabel('Auto Timeout', escalation.enabled),
            style: toggleStyle(escalation.enabled),
        })
    );

    const listRow1 = ComponentHelper.row(
        ComponentHelper.button({
            customId: 'setup:modal:swears',
            label: 'Set Custom Swears',
            style: ButtonStyle.Secondary,
        }),
        ComponentHelper.button({
            customId: 'setup:modal:banned',
            label: 'Set Banned Words',
            style: ButtonStyle.Secondary,
        }),
        ComponentHelper.button({
            customId: 'setup:modal:regex',
            label: 'Set Regex',
            style: ButtonStyle.Secondary,
        })
    );

    const listRow2 = ComponentHelper.row(
        ComponentHelper.button({
            customId: 'setup:clear:swears',
            label: 'Clear Swears',
            style: ButtonStyle.Danger,
        }),
        ComponentHelper.button({
            customId: 'setup:clear:banned',
            label: 'Clear Banned',
            style: ButtonStyle.Danger,
        }),
        ComponentHelper.button({
            customId: 'setup:clear:regex',
            label: 'Clear Regex',
            style: ButtonStyle.Danger,
        })
    );

    return {
        components: [
            ComponentHelper.container((container) =>
                container
                    .setAccentColor(0xe74c3c)
                    .addTextDisplayComponents(
                        ComponentHelper.textDisplay('# Filters'),
                        ComponentHelper.textDisplay(wordsSummary),
                        ComponentHelper.textDisplay(settingsSummary)
                    )
                    .addSeparatorComponents(
                        ComponentHelper.separator({ divider: true, spacing: SeparatorSpacingSize.Small })
                    )
                    .addTextDisplayComponents(
                        ComponentHelper.textDisplay('Toggles:'),
                        ComponentHelper.textDisplay('Use the buttons below to enable/disable filters.')
                    )
            ),
            toggleRow1,
            toggleRow2,
            ComponentHelper.separator({ divider: true, spacing: SeparatorSpacingSize.Small }),
            listRow1,
            listRow2,
            ...navRows('filters'),
        ],
        flags: ComponentHelper.componentsV2Flag(),
    };
}

function buildSticky(config: GuildConfig, channelId: string): SetupPanelPayload {
    const sticky = config.stickyMessages.find(
        (entry) => entry.channelId === channelId
    );
    const interval = sticky?.interval ?? 5;
    const content = sticky?.content
        ? sticky.content.length > 200
            ? `${sticky.content.slice(0, 200)}...`
            : sticky.content
        : 'No sticky message configured for this channel.';

    const actions = ComponentHelper.row(
        ComponentHelper.button({
            customId: 'setup:sticky:set',
            label: 'Set/Update Sticky Here',
            style: ButtonStyle.Primary,
        }),
        ComponentHelper.button({
            customId: 'setup:modal:stickyInterval',
            label: 'Set Interval',
            style: ButtonStyle.Secondary,
        }),
        ComponentHelper.button({
            customId: 'setup:sticky:disable',
            label: 'Disable Sticky Here',
            style: ButtonStyle.Danger,
        })
    );

    return {
        components: [
            ComponentHelper.container((container) =>
                container
                    .setAccentColor(0xf6ad55)
                    .addTextDisplayComponents(
                        ComponentHelper.textDisplay('# Sticky Messages'),
                        ComponentHelper.textDisplay(`Channel: <#${channelId}>`),
                        ComponentHelper.textDisplay(`Status: ${sticky?.enabled ? 'Enabled' : 'Disabled'}`),
                        ComponentHelper.textDisplay(`Interval: every ${interval} messages`),
                        ComponentHelper.textDisplay(content)
                    )
            ),
            actions,
            ...navRows('sticky'),
        ],
        flags: ComponentHelper.componentsV2Flag(),
    };
}

function buildLogging(config: GuildConfig): SetupPanelPayload {
    const channelLabel = config.logging?.modLogChannelId
        ? `<#${config.logging.modLogChannelId}>`
        : 'Not set';

    const select = new ChannelSelectMenuBuilder()
        .setCustomId('setup:log:channel')
        .setPlaceholder('Select a mod-log channel')
        .setMinValues(1)
        .setMaxValues(1)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

    const selectRow = ComponentHelper.row(select);

    const clearRow = ComponentHelper.row(
        ComponentHelper.button({
            customId: 'setup:log:clear',
            label: 'Clear Log Channel',
            style: ButtonStyle.Danger,
        })
    );

    return {
        components: [
            ComponentHelper.container((container) =>
                container
                    .setAccentColor(0x38b2ac)
                    .addTextDisplayComponents(
                        ComponentHelper.textDisplay('# Logging'),
                        ComponentHelper.textDisplay(`Current log channel: ${channelLabel}`),
                        ComponentHelper.textDisplay('Select a channel to receive moderation logs.')
                    )
            ),
            selectRow,
            clearRow,
            ...navRows('logging'),
        ],
        flags: ComponentHelper.componentsV2Flag(),
    };
}

function buildRoles(config: GuildConfig): SetupPanelPayload {
    const rolesLabel = config.autoRoles?.roleIds?.length
        ? config.autoRoles.roleIds.map((id) => `<@&${id}>`).join(', ')
        : 'No roles selected.';

    const select = new RoleSelectMenuBuilder()
        .setCustomId('setup:roles:select')
        .setPlaceholder('Select auto roles')
        .setMinValues(0)
        .setMaxValues(10);

    const selectRow = ComponentHelper.row(select);

    const toggleRow = ComponentHelper.row(
        ComponentHelper.button({
            customId: 'setup:roles:toggle',
            label: toggleLabel('Auto Roles', config.autoRoles?.enabled ?? false),
            style: toggleStyle(config.autoRoles?.enabled ?? false),
        })
    );

    return {
        components: [
            ComponentHelper.container((container) =>
                container
                    .setAccentColor(0x9f7aea)
                    .addTextDisplayComponents(
                        ComponentHelper.textDisplay('# Auto Roles'),
                        ComponentHelper.textDisplay(rolesLabel),
                        ComponentHelper.textDisplay('Select roles to auto-assign when users join.')
                    )
            ),
            selectRow,
            toggleRow,
            ...navRows('roles'),
        ],
        flags: ComponentHelper.componentsV2Flag(),
    };
}

function buildNotes(): SetupPanelPayload {
    return {
        components: [
            ComponentHelper.container((container) =>
                container
                    .setAccentColor(0x4a5568)
                    .addTextDisplayComponents(
                        ComponentHelper.textDisplay('# Mod Notes'),
                        ComponentHelper.textDisplay('Use `/note add`, `/note list`, and `/note remove`.'),
                        ComponentHelper.textDisplay('Keep short notes for quick moderation context.')
                    )
            ),
            ...navRows('notes'),
        ],
        flags: ComponentHelper.componentsV2Flag(),
    };
}

export function buildSetupPanel(
    page: SetupPage,
    config: GuildConfig,
    guildName: string,
    channelId: string
): SetupPanelPayload {
    switch (page) {
        case 'filters':
            return buildFilters(config);
        case 'sticky':
            return buildSticky(config, channelId);
        case 'logging':
            return buildLogging(config);
        case 'roles':
            return buildRoles(config);
        case 'notes':
            return buildNotes();
        case 'home':
        default:
            return buildHome(config, guildName);
    }
}
