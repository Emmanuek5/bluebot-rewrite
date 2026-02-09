import { Schema, model, models, type InferSchemaType } from 'mongoose';

const TempbanSchema = new Schema(
    {
        guildId: { type: String, required: true, index: true },
        userId: { type: String, required: true },
        moderatorId: { type: String, required: true },
        reason: { type: String, default: 'No reason provided' },
        expiresAt: { type: Date, required: true, index: true },
    },
    { timestamps: true }
);

export type Tempban = InferSchemaType<typeof TempbanSchema>;

const TempbanModel = models.Tempban || model<Tempban>('Tempban', TempbanSchema);

export default TempbanModel;
