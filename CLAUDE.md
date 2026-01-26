# CLAUDE.md

This file provides guidance to Claude Code when working on this repository.

## Project Overview

Infocom Chat is a Tambo demo that lets users play classic Infocom text adventures using natural language. It demonstrates Tambo's tool calling capabilities by translating conversational input into Z-machine parser commands.

## Architecture

- **`src/lib/zmachine.ts`** - Wrapper around JSZM that bridges the generator-based I/O with async/await. The Z-machine uses generators for `print` and `read` operations; we override these and drive execution with `.next()`.
- **`src/lib/tambo.ts`** - Defines the `sendGameCommand` Tambo tool with input/output schemas using Zod.
- **`src/App.tsx`** - Main React app with TamboProvider setup, system prompt, and chat UI.

## Key Patterns

### JSZM Generator Pattern
The Z-machine interpreter uses generators for I/O. We override `print` to accumulate output and `read` to yield a marker, then resume with `.next(userInput)`:

```typescript
this.game.read = function* (maxlen) {
  const input = yield { type: 'INPUT_NEEDED', maxlen };
  return input;
};
```

### Tambo Tool Definition
Tools use `inputSchema` and `outputSchema` (Zod schemas), not the deprecated `toolSchema`:

```typescript
const tool: TamboTool<Input, Output> = {
  name: 'sendGameCommand',
  description: '...',
  tool: async ({ command }) => { ... },
  inputSchema: z.object({ command: z.string() }),
  outputSchema: z.object({ output: z.string(), error: z.boolean() }),
};
```

### System Prompt Philosophy
The system prompt instructs the AI to BE the game, not a helper. It should:
- Never break the fourth wall
- Translate parser errors into in-world responses
- Avoid meta-commentary like "The game says..." or "Would you like to..."

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
```

## Dependencies

- `@tambo-ai/react` - Tambo React SDK (provides TamboProvider, hooks, tool types)
- `jszm` - Z-machine interpreter (installed from GitHub)
- `zod` - Schema validation for tool definitions
