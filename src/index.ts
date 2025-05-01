import "./polyfill";
import Bun from "bun";
import {
  context,
  createDreams,
  Logger,
  LogLevel,
  validateEnv,
  type AnyAgent,
} from "@daydreamsai/core";
import { z } from "zod";

import { chat } from "./chat";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { eternum } from "./eternum";
import { createInterface } from "readline/promises";
import { createAgentServer } from "./server";

validateEnv(
  z.object({
    OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
    // ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  })
);

// Create agent with async initialization
async function initializeAgent() {
  try {
    const agent = createDreams({
      logger: new Logger({ level: LogLevel.INFO }),
      model: openrouter("google/gemini-2.5-flash-preview"),
      extensions: [chat, eternum],
    }).start();

    console.log(`
      ____  _____  ______  ____  _________    __  ________
      / __ \/   \ \/ / __ \/ __ \/ ____/   |  /  |/  / ___/
     / / / / /| |\  / / / / /_/ / __/ / /| | / /|_/ /\__ \ 
    / /_/ / ___ |/ / /_/ / _, _/ /___/ ___ |/ /  / /___/ / 
   /_____/_/  |_/_/_____/_/ |_/_____/_/  |_/_/  /_//____/  
                                                           
`);
    console.log("DAYDREAMS ETERNUM AGENT BOOTING UP");

    return agent;
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    process.exit(1);
  }
}

// Start the agent
const agent = await initializeAgent();

// const cli = createInterface({
//   input: process.stdin,
//   output: process.stdout,
// });

// const eternumSession = context({
//   type: "eternum-session",
//   schema: { id: z.string() },
//   key: ({ id }) => id,
//   maxSteps: 2,
//   inputs: {
//     message: {
//       schema: z.string(),
//     },
//   },
//   outputs: {
//     message: {
//       schema: z.string(),
//       examples: [`<output type="message">Hi!</output>`],
//     },
//   },

//   async onStep() {
//     await cli.question("Press enter to continue...");
//   },
// }).use(() => [
//   { context: eternum.contexts!.eternum, args: { channelId: "eternum" } },
// ]);

// const res = await agent.send({
//   context: eternumChat,
//   args: { id: "chat-1" },
//   input: {
//     type: "message",
//     data: "Tell me what u see in the game dont play for now.",
//   },
// });

// console.log({ res });

//SERVER
// // await agent.getContext({
// //   context: eternumSession,
// //   args: { id: "session-1" },
// // });

// // const server = createAgentServer({
// //   agent,
// //   port: 7777,
// // });

// // console.log({ server });
