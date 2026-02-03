import {
    ActionRowBuilder,
    type AnyComponentBuilder,
    ButtonBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    MessageFlags,
    ButtonStyle,
    TextInputStyle,
    SeparatorSpacingSize,
} from 'discord.js';
import {
    TextDisplayBuilder,
    SeparatorBuilder,
    SectionBuilder,
    ThumbnailBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ContainerBuilder,
    FileBuilder,
} from '@discordjs/builders';

/**
 * Utility class to simplify creating Discord components.
 * This is a wrapper around discord.js builders to make them less verbose.
 */
export class ComponentHelper {
    /**
     * Components V2 note:
     * - You must set MessageFlags.IsComponentsV2 on the message payload.
     * - When using CV2, `content`, `embeds`, `poll`, and `stickers` are disabled.
     */
    static componentsV2Flag(): MessageFlags.IsComponentsV2 {
        return MessageFlags.IsComponentsV2;
    }
    
    /**
     * Create a standard Button
     */
    static button(options: {
        customId: string;
        label?: string;
        style?: ButtonStyle;
        emoji?: string;
        disabled?: boolean;
        url?: string;
    }): ButtonBuilder {
        const btn = new ButtonBuilder();
        
        if (options.url) {
            btn.setURL(options.url);
            btn.setStyle(ButtonStyle.Link);
        } else {
            btn.setCustomId(options.customId);
            btn.setStyle(options.style ?? ButtonStyle.Primary);
        }

        if (options.label) btn.setLabel(options.label);
        if (options.emoji) btn.setEmoji({ name: options.emoji });
        if (options.disabled) btn.setDisabled(options.disabled);

        return btn;
    }

    /**
     * Create an Action Row containing components
     */
    static row<T extends AnyComponentBuilder>(...components: T[]): ActionRowBuilder<T> {
        const row = new ActionRowBuilder<T>();
        row.addComponents(components);
        return row;
    }

    /**
     * Create a String Select Menu
     */
    static stringSelect(options: {
        customId: string;
        placeholder?: string;
        minValues?: number;
        maxValues?: number;
        disabled?: boolean;
        options: { label: string; value: string; description?: string; emoji?: string; default?: boolean }[];
    }): StringSelectMenuBuilder {
        const select = new StringSelectMenuBuilder()
            .setCustomId(options.customId)
            .setPlaceholder(options.placeholder ?? 'Select an option')
            .setDisabled(options.disabled ?? false);

        if (options.minValues) select.setMinValues(options.minValues);
        if (options.maxValues) select.setMaxValues(options.maxValues);

        const selectOptions = options.options.map(opt => {
            const builder = new StringSelectMenuOptionBuilder()
                .setLabel(opt.label)
                .setValue(opt.value)
                .setDefault(opt.default ?? false);
            
            if (opt.description) builder.setDescription(opt.description);
            if (opt.emoji) builder.setEmoji({ name: opt.emoji });
            
            return builder;
        });

        select.addOptions(selectOptions);
        return select;
    }

    /**
     * Components V2 helpers (display components)
     */
    static textDisplay(contentOrBuilder?: string | ((builder: TextDisplayBuilder) => TextDisplayBuilder)): TextDisplayBuilder {
        const builder = new TextDisplayBuilder();
        if (typeof contentOrBuilder === 'string') {
            builder.setContent(contentOrBuilder);
            return builder;
        }
        return contentOrBuilder ? contentOrBuilder(builder) : builder;
    }

    static separator(options: {
        spacing?: SeparatorSpacingSize;
        divider?: boolean;
        id?: number;
    } = {}): SeparatorBuilder {
        const builder = new SeparatorBuilder();
        if (options.spacing !== undefined) builder.setSpacing(options.spacing);
        if (options.divider !== undefined) builder.setDivider(options.divider);
        if (options.id !== undefined) builder.setId(options.id);
        return builder;
    }

    static section(builderFn?: (builder: SectionBuilder) => SectionBuilder): SectionBuilder {
        const builder = new SectionBuilder();
        return builderFn ? builderFn(builder) : builder;
    }

    static thumbnail(options: {
        url?: string;
        description?: string;
        spoiler?: boolean;
        id?: number;
    } = {}): ThumbnailBuilder {
        const builder = new ThumbnailBuilder();
        if (options.url) builder.setURL(options.url);
        if (options.description) builder.setDescription(options.description);
        if (options.spoiler !== undefined) builder.setSpoiler(options.spoiler);
        if (options.id !== undefined) builder.setId(options.id);
        return builder;
    }

    static mediaGallery(builderFn?: (builder: MediaGalleryBuilder) => MediaGalleryBuilder): MediaGalleryBuilder {
        const builder = new MediaGalleryBuilder();
        return builderFn ? builderFn(builder) : builder;
    }

    static mediaGalleryItem(options: {
        url?: string;
        description?: string;
        spoiler?: boolean;
    } = {}): MediaGalleryItemBuilder {
        const builder = new MediaGalleryItemBuilder();
        if (options.url) builder.setURL(options.url);
        if (options.description) builder.setDescription(options.description);
        if (options.spoiler !== undefined) builder.setSpoiler(options.spoiler);
        return builder;
    }

    static container(builderFn?: (builder: ContainerBuilder) => ContainerBuilder): ContainerBuilder {
        const builder = new ContainerBuilder();
        return builderFn ? builderFn(builder) : builder;
    }

    static file(options: {
        url?: string;
        spoiler?: boolean;
        id?: number;
    } = {}): FileBuilder {
        const builder = new FileBuilder();
        if (options.url) builder.setURL(options.url);
        if (options.spoiler !== undefined) builder.setSpoiler(options.spoiler);
        if (options.id !== undefined) builder.setId(options.id);
        return builder;
    }
}
