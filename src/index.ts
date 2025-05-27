import {
  createDreams,
  createMemory,
  createVectorStore,
  Logger,
  LogLevel,
  validateEnv,
  type AnyContext,
  type InferSchemaArguments,
  type MemoryStore,
} from "@daydreamsai/core";
import { z } from "zod";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { createAgentServer } from "./server";
import path from "path";
import { eternumSession } from "./contexts/session";
import { createInstructionsInput } from "./inputs";
import { chatExtension, createChatService } from "./contexts/chat";
import {
  generatePersonaUUID,
  type Persona,
} from "./contexts/utils/generate_persona";
import { createStore } from "./contexts/storage";
import { getAgentPersona } from "./contexts/utils/agent_gen";

validateEnv(
  z.object({
    OPENROUTER_API_KEY: z.string(),
    PUBLIC_KEY: z.string(),
    PRIVATE_KEY: z.string(),
    EXPLORER_ID: z.string(),
    SESSION_ID: z.string(),
    RPC_URL: z.string(),
    TORII_URL: z.string(),
    NETWORK: z.enum(["mainnet", "sepolia"]),
    WS_SERVER: z.string(),
  })
);

const INTERVAL_MINUTES = 1;

async function initalizePersona(store: MemoryStore, seed: number) {
  const cached = await store.get<Persona>("persona");
  if (cached) return cached;
  const persona = await getAgentPersona(seed);
  await store.set<Persona>("persona", persona);
  return persona;
}

// Create agent with async initialization
async function initializeAgent<TContext extends AnyContext>({
  explorerId,
  session,
  args,
}: {
  explorerId: number;
  session: TContext;
  args: InferSchemaArguments<TContext["schema"]>;
}) {
  try {
    const storagePath = path.resolve(import.meta.dir, `./data/${explorerId}`);
    const store = createStore(storagePath);

    await store.set(`eternum.wallet.${explorerId}`, {
      publicKey: process.env.PUBLIC_KEY,
      privateKey: process.env.PRIVATE_KEY,
    });

    const persona = await initalizePersona(store, explorerId);

    console.log({ name: persona.name });

    const chatService = createChatService({
      token: generatePersonaUUID(explorerId),
      username: persona.name,
    });

    const agent = createDreams({
      logger: new Logger({ level: LogLevel.DEBUG }),
      model: openrouter("google/gemini-2.0-flash-001"),
      memory: createMemory(store, createVectorStore()),
      inputs: {
        instructions: createInstructionsInput({
          context: session,
          args,
          message: [
            "Start/Verify your core loop, check/create intentions and entities and act on them",
            "Remember to check your max stamina, if your intentions are to move beyond your max stamina, you must make small moves and wait for stamina to regenerate.",
          ].join("\n"),
          interval: INTERVAL_MINUTES,
          enabled: true,
        }),
      },
      contexts: [session],
      services: [chatService],
      extensions: [chatExtension],
    });

    await agent.start();

    //SERVER
    await agent.getContext({
      context: session,
      args,
    });

    createAgentServer({
      agent,
      port: 3000,
    });

    return agent;
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    process.exit(1);
  }
}

console.log(`
      ____  _____  ______  ____  _________    __  ________
      / __ \/   \ \/ / __ \/ __ \/ ____/   |  /  |/  / ___/
     / / / / /| |\  / / / / /_/ / __/ / /| | / /|_/ /\__ \ 
    / /_/ / ___ |/ / /_/ / _, _/ /___/ ___ |/ /  / /___/ / 
   /_____/_/  |_/_/_____/_/ |_/_____/_/  |_/_/  /_//____/  
                                                           
`);

console.log("DAYDREAMS ETERNUM AGENT BOOTING UP");

const explorerId = parseInt(Bun.env.EXPLORER_ID!);
const sessionId = Bun.env.SESSION_ID!;

await initializeAgent({
  explorerId,
  session: eternumSession,
  args: {
    explorerId,
    sessionId,
  },
});
