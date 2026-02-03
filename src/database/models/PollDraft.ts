import { Schema, model, models, type InferSchemaType } from 'mongoose';

const PollDraftSchema = new Schema(
    {
        guildId: { type: String, required: true, index: true },
        channelId: { type: String, required: true },
        createdBy: { type: String, required: true, index: true },
        question: { type: String, default: '' },
        options: { type: [String], default: [] },
        durationMinutes: { type: Number, default: null },
    },
    { timestamps: true }
);

export type PollDraft = InferSchemaType<typeof PollDraftSchema>;

const PollDraftModel = models.PollDraft || model<PollDraft>('PollDraft', PollDraftSchema);

export default PollDraftModel;
