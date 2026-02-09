# Changelog

## [Unreleased] - 2026-02-09

### Added

#### New Commands

- **`/warn add|list|remove|clear`** — Full warning system with DM notifications
  - `src/commands/Moderation/warn.ts`
  - `src/database/models/Warning.ts` (new Mongoose model)

- **`/kick`** — Kick members with role hierarchy checks and DM notification
  - `src/commands/Moderation/kick.ts`

- **`/ban add|remove|list`** — Ban/unban users with message deletion option, list bans
  - `src/commands/Moderation/ban.ts`

- **`/mute add|remove`** — Timeout members using Discord's native timeout with duration choices, DM notification
  - `src/commands/Moderation/mute.ts`

- **`/lock add|remove`** — Lock/unlock channels (denies SendMessages, AddReactions, CreatePublicThreads for @everyone)
  - `src/commands/Moderation/lock.ts`

- **`/slowmode`** — Set channel slowmode with preset duration choices
  - `src/commands/Moderation/slowmode.ts`

- **`/purge`** — Bulk delete messages with optional user filter (respects 14-day limit)
  - `src/commands/Moderation/purge.ts`

- **`/lockdown start|end`** — Emergency server-wide lockdown (locks all text/announcement channels, restores on end). Lockdown state is persisted in the database so it survives bot restarts.
  - `src/commands/Moderation/lockdown.ts`

- **`/modrole set|clear|view`** — Configure a moderator role that bypasses automod filters
  - `src/commands/Moderation/modrole.ts`

- **`/ignore add|remove|list`** — Manage channels ignored by automod
  - `src/commands/Moderation/ignore.ts`

- **`/tempban`** — Temporarily ban a user with auto-unban via scheduler. Supports duration choices and message deletion.
  - `src/commands/Moderation/tempban.ts`
  - `src/database/models/Tempban.ts` (new Mongoose model)
  - `src/services/tempbanScheduler.ts` (new scheduler, runs every 60s)

- **`/case view|edit|search`** — Unified moderation case system. Every mod action creates a numbered case.
  - `src/commands/Moderation/case.ts`
  - `src/database/models/ModerationCase.ts` (new Mongoose model with auto-incrementing case numbers)

- **`/userinfo`** — View user details: account age, join date, roles, nickname, boost status, timeout, warning count, case count
  - `src/commands/General/userinfo.ts`

- **`/serverinfo`** — View server details: member count, channels, roles, emojis, boost level, verification
  - `src/commands/General/serverinfo.ts`

#### Schema Changes

- **`GuildConfig`** — Added `modRoleId` (String), `ignoredChannelIds` ([String]), and `lockdownChannelIds` ([String]) fields
  - `src/database/models/GuildConfig.ts`

#### Mod Logging Overhaul

- **`src/services/modLog.ts`** — Rewritten to support both automod and command-based logging with automatic case creation
  - `logModerationAction()` — Automod actions now create cases and log with case numbers
  - `logCommandAction()` — New function for slash command mod actions (kick, ban, mute, warn, lock, lockdown, purge, tempban)
  - Log messages are stored with `logMessageId` for future reference
- All moderation commands now create cases and log to the mod log channel:
  - `src/commands/Moderation/warn.ts`
  - `src/commands/Moderation/kick.ts`
  - `src/commands/Moderation/ban.ts`
  - `src/commands/Moderation/mute.ts`
  - `src/commands/Moderation/lock.ts`
  - `src/commands/Moderation/lockdown.ts`
  - `src/commands/Moderation/purge.ts`
  - `src/commands/Moderation/tempban.ts`

#### Scheduler Updates

- **Tempban scheduler** registered in `src/events/ready.ts` alongside poll scheduler

#### Automod Improvements

- `src/events/messageCreate.ts` — Added bypass logic for:
  - Channels in `ignoredChannelIds` (sticky messages still work)
  - Members with the configured `modRoleId`

#### Autocomplete Handlers

- **`/warn remove`** — Autocomplete for warning ID, shows recent warnings with reason, user, and date
  - `src/autocompletes/warn.ts`
  - `src/commands/Moderation/warn.ts` — enabled `.setAutocomplete(true)` on `id` option

- **`/case view|edit`** — Autocomplete for case number, shows recent cases with action, target, and reason
  - `src/autocompletes/case.ts`
  - `src/commands/Moderation/case.ts` — changed `number` from IntegerOption to StringOption with autocomplete

- **`/ban remove`** — Autocomplete for user ID, searches the server ban list by username/tag/ID
  - `src/autocompletes/ban.ts`
  - `src/commands/Moderation/ban.ts` — enabled `.setAutocomplete(true)` on `user_id` option

- **`/autoresponder remove`** — Autocomplete for trigger ID, shows keyword and response preview
  - `src/autocompletes/autoresponder.ts`

#### AI Features (Vercel AI SDK + OpenRouter)

- **Dependencies:** `ai@6.x`, `@openrouter/ai-sdk-provider@2.x`

- **`/ask`** — Ask the AI a question, get a response in an embed. Respects per-server model, system prompt, max tokens, and channel restrictions.
  - `src/commands/AI/ask.ts`

- **`/ai enable|disable|model|prompt|channel|maxtokens|settings`** — Full AI configuration per server
  - `src/commands/AI/ai.ts`

- **`/autoresponder add|remove|list`** — Manage keyword-triggered auto-responders. Supports AI mode (generates response using trigger context as knowledge base) and static mode (sends response text directly). Optional channel restriction.
  - `src/commands/AI/autoresponder.ts`

- **AI Service** — Centralized AI generation helper using OpenRouter provider
  - `src/services/ai.ts`

- **Auto-Responder Integration** — `src/events/messageCreate.ts` now checks messages against configured auto-responder triggers after moderation and sticky handling

- **Schema Changes:**
  - `GuildConfig.ai` — `enabled`, `model`, `systemPrompt`, `allowedChannelIds`, `maxTokens`
  - `GuildConfig.autoResponders` — Array of `{ keyword, response, useAI, channelIds }`
  - `src/config.ts` — Added `OPENROUTER_API_KEY` export

### Fixed

- **`/reactionroles delete`** — Added missing `resolveChannel` helper function that was called but never defined
  - `src/commands/Moderation/reactionroles.ts`
