import { Schema, model, models, type InferSchemaType } from 'mongoose';

const ModNoteSchema = new Schema(
    {
        guildId: { type: String, required: true, index: true },
        userId: { type: String, required: true, index: true },
        authorId: { type: String, required: true },
        note: { type: String, required: true },
    },
    { timestamps: true }
);

export type ModNote = InferSchemaType<typeof ModNoteSchema>;

const ModNoteModel = models.ModNote || model<ModNote>('ModNote', ModNoteSchema);

export default ModNoteModel;
