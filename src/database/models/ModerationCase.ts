import { Schema, model, models, type InferSchemaType } from 'mongoose';

const ModerationCaseSchema = new Schema(
    {
        guildId: { type: String, required: true, index: true },
        caseNumber: { type: Number, required: true },
        action: {
            type: String,
            required: true,
            enum: ['warn', 'kick', 'ban', 'unban', 'mute', 'unmute', 'lock', 'unlock', 'lockdown', 'purge', 'tempban', 'automod'],
        },
        targetId: { type: String, required: true, index: true },
        targetTag: { type: String, required: true },
        moderatorId: { type: String, required: true },
        moderatorTag: { type: String, required: true },
        reason: { type: String, default: 'No reason provided' },
        duration: { type: Number, default: null },
        logMessageId: { type: String, default: null },
    },
    { timestamps: true }
);

ModerationCaseSchema.index({ guildId: 1, caseNumber: 1 }, { unique: true });

export type ModerationCase = InferSchemaType<typeof ModerationCaseSchema>;

export async function getNextCaseNumber(guildId: string): Promise<number> {
    const last = await ModerationCaseModel.findOne({ guildId }).sort({ caseNumber: -1 }).lean();
    return (last?.caseNumber ?? 0) + 1;
}

const ModerationCaseModel =
    models.ModerationCase || model<ModerationCase>('ModerationCase', ModerationCaseSchema);

export default ModerationCaseModel;
