import { Schema, model, models, type InferSchemaType } from 'mongoose';

const WarningSchema = new Schema(
    {
        guildId: { type: String, required: true, index: true },
        userId: { type: String, required: true, index: true },
        moderatorId: { type: String, required: true },
        reason: { type: String, required: true },
    },
    { timestamps: true }
);

export type Warning = InferSchemaType<typeof WarningSchema>;

const WarningModel = models.Warning || model<Warning>('Warning', WarningSchema);

export default WarningModel;
