import { Schema, model, models, type InferSchemaType } from 'mongoose';

const ReactionRoleDraftItemSchema = new Schema(
    {
        roleId: { type: String, required: true },
        label: { type: String, required: true },
        emoji: { type: String, default: null },
    },
    { _id: false }
);

const ReactionRoleDraftSchema = new Schema(
    {
        guildId: { type: String, required: true, index: true },
        channelId: { type: String, required: true },
        createdBy: { type: String, required: true, index: true },
        title: { type: String, default: '' },
        description: { type: String, default: '' },
        items: { type: [ReactionRoleDraftItemSchema], default: [] },
        panelId: { type: String, default: null },
    },
    { timestamps: true }
);

export type ReactionRoleDraft = InferSchemaType<typeof ReactionRoleDraftSchema>;

const ReactionRoleDraftModel =
    models.ReactionRoleDraft || model<ReactionRoleDraft>('ReactionRoleDraft', ReactionRoleDraftSchema);

export default ReactionRoleDraftModel;
