import { BaseCommand } from '../../structures/Command.ts';
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import ModNoteModel from '../../database/models/ModNote.ts';

export default class NoteCommand extends BaseCommand {
    constructor() {
        super(
            new SlashCommandBuilder()
                .setName('note')
                .setDescription('Manage moderator notes')
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
                .addSubcommand((sub) =>
                    sub
                        .setName('add')
                        .setDescription('Add a note for a user')
                        .addUserOption((opt) =>
                            opt.setName('user').setDescription('User to note').setRequired(true)
                        )
                        .addStringOption((opt) =>
                            opt.setName('note').setDescription('Note content').setRequired(true)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('list')
                        .setDescription('List notes for a user')
                        .addUserOption((opt) =>
                            opt.setName('user').setDescription('User to view').setRequired(true)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('remove')
                        .setDescription('Remove a note by ID')
                        .addStringOption((opt) =>
                            opt.setName('id').setDescription('Note ID').setRequired(true)
                        )
                )
        );
    }

    public override async execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
        if (!interaction.inGuild()) {
            await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            return;
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            const user = interaction.options.getUser('user', true);
            const note = interaction.options.getString('note', true);

            const doc = await ModNoteModel.create({
                guildId: interaction.guildId,
                userId: user.id,
                authorId: interaction.user.id,
                note,
            });

            await interaction.reply({
                content: `Note added for ${user.tag}. ID: ${doc.id}`,
                ephemeral: true,
            });
            return;
        }

        if (sub === 'list') {
            const user = interaction.options.getUser('user', true);
            const notes = await ModNoteModel.find({
                guildId: interaction.guildId,
                userId: user.id,
            })
                .sort({ createdAt: -1 })
                .limit(10);

            if (!notes.length) {
                await interaction.reply({
                    content: `No notes found for ${user.tag}.`,
                    ephemeral: true,
                });
                return;
            }

            const lines = notes.map(
                (n) =>
                    `- ${n.id} - ${n.note} (by <@${n.authorId}>, ${n.createdAt.toLocaleDateString()})`
            );

            await interaction.reply({
                content: `Notes for ${user.tag}:\n${lines.join('\n')}`,
                ephemeral: true,
            });
            return;
        }

        if (sub === 'remove') {
            const id = interaction.options.getString('id', true);
            const result = await ModNoteModel.findOneAndDelete({
                _id: id,
                guildId: interaction.guildId,
            });

            if (!result) {
                await interaction.reply({ content: 'Note not found.', ephemeral: true });
                return;
            }

            await interaction.reply({ content: 'Note removed.', ephemeral: true });
        }
    }
}
