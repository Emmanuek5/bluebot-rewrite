import { 
    ButtonInteraction, 
    ModalSubmitInteraction, 
    AnySelectMenuInteraction, 
    Client 
} from 'discord.js';

export type InteractionType = 'button' | 'modal' | 'select';

export abstract class BaseInteraction {
    public readonly customId: string;
    public readonly type: InteractionType;

    /**
     * @param customId The custom ID to match. Can be a literal string or a prefix.
     * @param type The type of interaction this handler supports.
     */
    constructor(customId: string, type: InteractionType) {
        this.customId = customId;
        this.type = type;
    }

    /**
     * Determines if this handler handles the given customId.
     * Defaults to strict equality, but can be overridden for "startsWith" or regex logic.
     */
    public matches(customId: string): boolean {
        return customId === this.customId || customId.startsWith(`${this.customId}:`);
    }

    public abstract execute(interaction: ButtonInteraction | ModalSubmitInteraction | AnySelectMenuInteraction, client: Client): Promise<void>;
}
