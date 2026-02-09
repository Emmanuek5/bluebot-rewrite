import { Schema, model, models, type InferSchemaType } from 'mongoose';

const StickyMessageSchema = new Schema(
    {
        channelId: { type: String, required: true },
        content: { type: String, required: true },
        enabled: { type: Boolean, default: true },
        interval: { type: Number, default: 5 },
        lastMessageId: { type: String, default: null },
    },
    { _id: false }
);

const AutoResponderTriggerSchema = new Schema(
    {
        keyword: { type: String, required: true },
        response: { type: String, required: true },
        useAI: { type: Boolean, default: true },
        channelIds: { type: [String], default: [] },
    },
    { _id: true }
);

const GuildConfigSchema = new Schema(
    {
        guildId: { type: String, required: true, unique: true, index: true },
        moderation: {
            swears: {
                enabled: { type: Boolean, default: false },
                words: { type: [String], default: [] },
            },
            bannedWords: {
                enabled: { type: Boolean, default: false },
                words: { type: [String], default: [] },
            },
            regexFilters: {
                enabled: { type: Boolean, default: false },
                patterns: { type: [String], default: [] },
            },
            caps: {
                enabled: { type: Boolean, default: false },
                ratio: { type: Number, default: 0.7 },
                minLength: { type: Number, default: 8 },
            },
            mentions: {
                enabled: { type: Boolean, default: false },
                max: { type: Number, default: 5 },
            },
            bypassStaff: { type: Boolean, default: true },
            escalation: {
                enabled: { type: Boolean, default: true },
                maxViolations: { type: Number, default: 3 },
                windowMinutes: { type: Number, default: 5 },
                timeoutMinutes: { type: Number, default: 5 },
            },
        },
        logging: {
            modLogChannelId: { type: String, default: null },
        },
        autoRoles: {
            enabled: { type: Boolean, default: false },
            roleIds: { type: [String], default: [] },
        },
        modRoleId: { type: String, default: null },
        ignoredChannelIds: { type: [String], default: [] },
        lockdownChannelIds: { type: [String], default: [] },
        ai: {
            enabled: { type: Boolean, default: false },
            model: { type: String, default: 'openai/gpt-4o-mini' },
            systemPrompt: { type: String, default: 'You are a helpful Discord bot assistant. Be concise and friendly.' },
            allowedChannelIds: { type: [String], default: [] },
            maxTokens: { type: Number, default: 1024 },
        },
        autoResponders: { type: [AutoResponderTriggerSchema], default: [] },
        stickyMessages: { type: [StickyMessageSchema], default: [] },
    },
    { timestamps: true }
);

export type GuildConfig = InferSchemaType<typeof GuildConfigSchema>;

const GuildConfigModel =
    models.GuildConfig || model<GuildConfig>('GuildConfig', GuildConfigSchema);

export default GuildConfigModel;
