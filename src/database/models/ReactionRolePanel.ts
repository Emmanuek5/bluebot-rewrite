import { Schema, model, models, type InferSchemaType } from 'mongoose';

const ReactionRoleItemSchema = new Schema(
    {
        roleId: { type: String, required: true },
        label: { type: String, required: true },
        emoji: { type: String, default: null },
    },
    { _id: false }
);

const ReactionRolePanelSchema = new Schema(
    {
        guildId: { type: String, required: true, index: true },
        channelId: { type: String, required: true },
        messageId: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String, default: '' },
        items: { type: [ReactionRoleItemSchema], default: [] },
        createdBy: { type: String, required: true },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

export type ReactionRolePanel = InferSchemaType<typeof ReactionRolePanelSchema>;

const ReactionRolePanelModel =
    models.ReactionRolePanel || model<ReactionRolePanel>('ReactionRolePanel', ReactionRolePanelSchema);

export default ReactionRolePanelModel;
