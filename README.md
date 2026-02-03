# bluebot-rewrite

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.6. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Environment Variables

- `DISCORD_TOKEN` (required): Bot token
- `CLIENT_ID` (required for deploy script): Discord application client ID
- `GUILD_ID` (optional): If set, commands deploy to this guild only
- `MONGO_URI` (required): MongoDB connection string
- `MONGO_DB` (optional): Database name override

## Moderation Setup

Open the setup panel:
```bash
/setup
```

Features included:
- Swear monitoring (log only)
- Banned words (delete + warn)
- Regex filters (delete + warn)
- Caps detection (warn)
- Mention spam detection (warn)
- Sticky messages
- Mod logging
- Mod notes (`/note add`, `/note list`, `/note remove`)
- Auto roles on join

## Components V2 (Display Components)

Discord's Components V2 (a.k.a. Display Components) are supported via helpers in
`src/structures/Component.ts`. V1 components (buttons/selects/modals) continue
to work as-is.

Key rules:
- When using V2 display components, you must set the message flag
  `MessageFlags.IsComponentsV2`.
- When that flag is set, you cannot use `content`, `embeds`, `poll`, or
  `stickers`. Attachments must be referenced through components.

Helpers added:
- `ComponentHelper.componentsV2Flag()`
- `ComponentHelper.textDisplay(...)`
- `ComponentHelper.separator(...)`
- `ComponentHelper.section(...)`
- `ComponentHelper.thumbnail(...)`
- `ComponentHelper.mediaGallery(...)`
- `ComponentHelper.mediaGalleryItem(...)`
- `ComponentHelper.container(...)`
- `ComponentHelper.file(...)`

Example:
```ts
import { ComponentHelper } from './structures/Component.ts';

const header = ComponentHelper.textDisplay('Hello from CV2!');
const sep = ComponentHelper.separator();
const file = ComponentHelper.file({ url: 'attachment://guide.pdf' });

await interaction.reply({
  components: [header, sep, file],
  flags: ComponentHelper.componentsV2Flag(),
  files: [attachment],
});
```
