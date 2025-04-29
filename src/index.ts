import "./polyfill";

import { createDreams, Logger, LogLevel, validateEnv } from "@daydreamsai/core";
import { z } from "zod";

import { chat } from "./chat";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { eternum } from "./eternum";

validateEnv(
  z.object({
    OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
    ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
    // CHROMADB_URL: z.string().optional().default("http://chromadb:8001"),
  })
);

// Create agent with async initialization
async function initializeAgent() {
  try {
    const agent = createDreams({
      logger: new Logger({ level: LogLevel.DEBUG }),
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
initializeAgent();
