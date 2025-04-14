import "./polyfill";

import {
  context,
  createDreams,
  LogLevel,
  render,
  validateEnv,
} from "@daydreamsai/core";
import { string, z } from "zod";

import { generateCharacter } from "./character-gen";
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

export const seed =
  parseInt(process.env.SEED! || process.env.EVENT_DATA_1! || "1234567891011") *
  99999;

const character = generateCharacter({
  seed: seed,
});

const template = `


Here is the current goal:

Goal: {{goal}} 
Tasks: {{tasks}}
Current Task: {{currentTask}}
`;

const goalContexts = context({
  type: "goal",
  schema: z.object({
    id: string(),
    initialGoal: z.string(),
    initialTasks: z.array(z.string()),
  }),

  key({ id }) {
    return id;
  },

  create(state) {
    return {
      goal: state.args.initialGoal,
      tasks: state.args.initialTasks ?? [],
      currentTask: state.args.initialTasks?.[0],
    };
  },

  render({ memory }) {
    return render(template, {
      goal: memory.goal,
      tasks: memory.tasks.join("\n"),
      currentTask: memory.currentTask ?? "NONE",
    });
  },
});

// Create agent with async initialization
async function initializeAgent() {
  try {
    const agent = createDreams({
      logger: LogLevel.DEBUG,
      model: openrouter("deepseek/deepseek-r1-distill-llama-70b"),
      context: goalContexts,
      extensions: [chat, eternum],
    }).start({ id: "test", initialGoal: "", initialTasks: [] });

    console.log("Starting Daydreams Discord Bot...");
    console.log("Daydreams Discord Bot started");

    return agent;
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    process.exit(1);
  }
}

// Start the agent
initializeAgent();
