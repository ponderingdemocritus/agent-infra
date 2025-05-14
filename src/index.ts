import "./markdown-plugin ";
import {
  context,
  createDreams,
  createMemory,
  createMemoryStore,
  createVectorStore,
  input,
  Logger,
  LogLevel,
  validateEnv,
  type AnyAgent,
  type MemoryStore,
} from "@daydreamsai/core";
import { z } from "zod";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { createInterface } from "readline/promises";
import { createAgentServer } from "./server";
import { game_loop, player_context } from "./contexts/player";
import { game_map_context } from "./contexts/game_map";
import { game_rules_and_directives } from "./contexts/game_rules";
import { persona_context } from "./contexts/persona";
import { intentions_context } from "./contexts/intentions";
import { known_entities_context } from "./contexts/know_entities";

import { createStorage } from "unstorage";
import fsDriver from "unstorage/drivers/fs";
import path from "path";
import { checkForDeath } from "./death";

validateEnv(
  z.object({
    OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
    // ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  })
);

const INTERVAL_MINUTES = 0.2;

const eternumSession = context({
  type: "eternum-session",
  schema: { explorerId: z.number(), sessionId: z.string() },
  key: ({ explorerId, sessionId }) => `${explorerId}-${sessionId}`,
  inputs: {
    message: {
      schema: z.string(),
    },
  },

  outputs: {
    message: {
      schema: z.string(),
      examples: [`<output type="message">Hi!</output>`],
    },
  },

  // async onStep() {
  //   await cli.question("Press enter to continue...");
  // },
}).use(({ args }) => [
  { context: game_rules_and_directives, args: {} },
  { context: game_loop, args: {} },
  { context: persona_context, args: { id: args.explorerId.toString() } },
  { context: player_context, args: { playerId: args.explorerId } },
  { context: game_map_context, args: { playerId: args.explorerId } },
  { context: known_entities_context, args: { playerId: args.explorerId } },
  { context: intentions_context, args: { playerId: args.explorerId } },
]);

// Create agent with async initialization
async function initializeAgent({ explorerId }: { explorerId: number }) {
  const baseStorage = path.resolve(import.meta.dir, `./data/${explorerId}`);

  const storage = createStorage({
    driver: fsDriver({
      base: baseStorage,
    }),
  });

  const store: MemoryStore = {
    ...storage,
    async delete(key) {
      await storage.remove(key);
    },
  };

  try {
    const agent = createDreams({
      logger: new Logger({ level: LogLevel.DEBUG }),
      model: openrouter("google/gemini-2.5-flash-preview"),
      memory: createMemory(store, createVectorStore()),
      inputs: {
        "recurring:trigger": input({
          schema: z.object({
            timestamp: z.number(),
            message: z.string(),
          }),
          format: ({ timestamp }) =>
            `Recurring task triggered at ${new Date(timestamp).toISOString()}`,

          async subscribe(send) {
            const intervalMs = INTERVAL_MINUTES * 60 * 1000;

            console.info(
              "Setting up recurring task",
              JSON.stringify({
                interval_minutes: INTERVAL_MINUTES,
              })
            );

            const intervalId = setInterval(async () => {
              send(
                eternumSession,
                {
                  explorerId: parseInt(process.env.EVENT_DATA_1!),
                  sessionId: "session-1",
                },
                {
                  timestamp: Date.now(),
                  message: "Try and move around and attack entities! 💀",
                }
              );
            }, intervalMs);

            return () => {
              clearInterval(intervalId);
            };
          },
        }),
      },
    }).start();

    console.log(`
      ____  _____  ______  ____  _________    __  ________
      / __ \/   \ \/ / __ \/ __ \/ ____/   |  /  |/  / ___/
     / / / / /| |\  / / / / /_/ / __/ / /| | / /|_/ /\__ \ 
    / /_/ / ___ |/ / /_/ / _, _/ /___/ ___ |/ /  / /___/ / 
   /_____/_/  |_/_/_____/_/ |_/_____/_/  |_/_/  /_//____/  
                                                           
`);
    console.log("DAYDREAMS ETERNUM AGENT BOOTING UP");

    checkForDeath().catch((error) => {
      console.error("Unhandled error in agent:", error);
    });

    return agent;
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    process.exit(1);
  }
}

// Start the agent
const agent = await initializeAgent({
  explorerId: parseInt(process.env.EVENT_DATA_1!),
});

const cli = createInterface({
  input: process.stdin,
  output: process.stdout,
});

//SERVER
await agent.getContext({
  context: eternumSession,
  args: {
    explorerId: parseInt(process.env.EVENT_DATA_1!),
    sessionId: "session-1",
  },
});

const server = createAgentServer({
  agent,
  port: 7777,
});

// console.log({ server });
