import { TamboTool } from '@tambo-ai/react';
import { z } from 'zod';
import { getGameRunner } from './zmachine';

const inputSchema = z.object({
  command: z.string().describe('The Infocom command to execute (e.g., "TAKE LAMP", "GO NORTH", "INVENTORY")'),
});

const outputSchema = z.object({
  output: z.string().describe('The game response text'),
  error: z.boolean().describe('Whether an error occurred'),
});

type ToolInput = z.infer<typeof inputSchema>;
type ToolOutput = z.infer<typeof outputSchema>;

export const tools: TamboTool<ToolInput, ToolOutput>[] = [
  {
    name: 'sendGameCommand',
    description: `Execute a command in the Infocom text adventure game.

      CRITICAL: You MUST call this tool for EVERY user message. The user is playing a game and
      expects their input to be translated into game commands. Never respond without making at
      least one tool call.

      If the user's message contains MULTIPLE actions (e.g., "go north then east then look"),
      you MUST make SEPARATE tool calls for each action in sequence. Show the player the result
      of each command as you progress through their request.

      Common commands:
      - Movement: NORTH (or N), SOUTH (S), EAST (E), WEST (W), UP, DOWN, ENTER, EXIT
      - Looking: LOOK (or L), EXAMINE [thing] (or X [thing])
      - Inventory: INVENTORY (or I)
      - Taking/Dropping: TAKE [item], DROP [item], PUT [item] IN [container]
      - Interaction: OPEN [thing], CLOSE [thing], READ [thing], TURN ON [thing]
      - Combat: ATTACK [creature] WITH [weapon], KILL [creature]
      - Meta: SAVE, RESTORE, RESTART, QUIT, SCORE, VERBOSE, BRIEF

      ALWAYS attempt to translate ANY user input into game commands, even if it seems unusual.
      Be creative! If the user says something conversational, interpret it as a game action:
      - "What's going on?" -> LOOK
      - "I'm bored" -> LOOK or INVENTORY
      - "hello" -> LOOK (show them where they are)
      - "help" -> LOOK (to remind them of their surroundings)
      - "what now?" -> LOOK
      - Greetings or casual chat -> interpret as interest in the current situation

      Multi-step examples (make SEPARATE tool calls for each):
      - "go north and then west" -> NORTH, then WEST (2 calls)
      - "take the lamp, turn it on, and go down" -> TAKE LAMP, TURN ON LAMP, DOWN (3 calls)
      - "look around, grab everything, check inventory" -> LOOK, TAKE ALL, INVENTORY (3 calls)

      Single command examples:
      - "What do I have?" -> INVENTORY
      - "Look around" -> LOOK
      - "Pick up the sword" -> TAKE SWORD
      - "Go through the door" -> ENTER or appropriate direction`,
    tool: async ({ command }) => {
      const runner = getGameRunner();
      if (!runner) {
        return { output: 'Game not initialized. Please refresh the page.', error: true };
      }
      if (!runner.isWaitingForInput()) {
        return { output: 'Game is not ready for input.', error: true };
      }

      try {
        const output = await runner.sendCommand(command);
        return { output, error: false };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { output: `Error: ${message}`, error: true };
      }
    },
    inputSchema,
    outputSchema,
  },
];
