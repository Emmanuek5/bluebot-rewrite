import { Schema, model, models, type InferSchemaType } from 'mongoose';

const PollOptionSchema = new Schema(
    {
        optionId: { type: String, required: true },
        label: { type: String, required: true },
        votes: { type: [String], default: [] },
    },
    { _id: false }
);

const PollSchema = new Schema(
    {
        guildId: { type: String, required: true, index: true },
        channelId: { type: String, required: true },
        messageId: { type: String, required: true },
        question: { type: String, required: true },
        options: { type: [PollOptionSchema], required: true },
        createdBy: { type: String, required: true },
        endsAt: { type: Date, default: null },
        isClosed: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export type Poll = InferSchemaType<typeof PollSchema>;

const PollModel = models.Poll || model<Poll>('Poll', PollSchema);

export default PollModel;
