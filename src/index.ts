import {
  context,
  createDreams,
  createMemory,
  createVectorStore,
  input,
  Logger,
  LogLevel,
  output,
  validateEnv,
  type AnyContext,
  type InferSchemaArguments,
  type MemoryStore,
} from "@daydreamsai/core";
import { z } from "zod";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { createAgentServer } from "./server";
import path from "path";
import { checkForDeath } from "./death";
import { eternumSession } from "./contexts/session";
import { createInstructionsInput } from "./inputs";
import { createChatService } from "./contexts/chat";
import {
  generatePersona,
  generatePersonaUUID,
  type Persona,
} from "./contexts/utils/generate_persona";
import ChatClient, { isGlobalMsg } from "./chat-client";
import { sleep } from "bun";
import { createStore } from "./contexts/storage";
import { parseArgs } from "util";

validateEnv(
  z.object({
    OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  })
);

const INTERVAL_MINUTES = 5;

async function initalizePersona(store: MemoryStore, seed: number) {
  const cached = await store.get<Persona>("persona");
  if (cached) return cached;
  const persona = await generatePersona(seed);
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

    const persona = await initalizePersona(store, explorerId);

    console.log({ name: persona.name });

    const chatService = createChatService({
      token: generatePersonaUUID(explorerId),
      username: persona.name,
    });

    const agent = createDreams({
      logger: new Logger({ level: LogLevel.DEBUG }),
      model: openrouter("google/gemini-2.5-flash-preview"),
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
    });

    await agent.start();

    //SERVER
    await agent.getContext({
      context: session,
      args,
    });

    // createAgentServer({
    //   agent,
    //   port: 7777,
    // });

    checkForDeath({ explorerId, eventId: 0 }).catch((error) => {
      console.error("Unhandled error in agent:", error);
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

const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    explorer: {
      type: "string",
      short: "e",
    },
    session: {
      type: "string",
      default: "session-1",
      short: "s",
    },
    port: {
      type: "string",
      default: "7777",
      short: "p",
    },
  },
  strict: true,
  allowPositionals: true,
});

if (!values.explorer) throw new Error("invalid explorer");

// const explorerId = parseInt(process.env.EVENT_DATA_1!);
const explorerId = parseInt(values.explorer, 10);
const sessionId = values.session;

// Start the agent
const agent = await initializeAgent({
  explorerId,
  session: eternumSession,
  args: {
    explorerId,
    sessionId,
  },
});

// chat testing

const chatClient = agent.container.resolve<ChatClient>("eternum.chat");

await new Promise<void>((resolve) =>
  chatClient.socket.on("connect", () => {
    resolve();
  })
);
// await agent.send({
//   context: eternumSession,
//   args: { explorerId, sessionId },
//   input: {
//     type: "instructions",
//     data: "remember that your max stamina is 200, if your intentions are to move beyond 200 stamina, you must make small moves and wait for stamina to regenerate.",
//   },
// });

// const global_chat_context = context({
//   type: "chat.global",
//   inputs: {
//     "chat.message": input({
//       schema: {
//         user: z.string(),
//         content: z.string(),
//       },
//     }),
//   },
//   outputs: {
//     "chat.message": output({
//       schema: z.string(),
//       async handler(data, ctx, agent) {
//         console.log({ data });
//         return {
//           data,
//         };
//       },
//     }),
//   },
// });

// chatClient.startMessageStream(async (msg) => {
//   console.log({ msg });

//   if (isGlobalMsg(msg)) {
//     await agent.send({
//       context: global_chat_context,
//       args: {},
//       input: {
//         type: "chat.message",
//         data: {
//           user: msg.userName,
//           content: msg.data.content,
//         },
//       },
//     });
//   } else {
//   }
// });

// console.log(await chatClient.sendRoomMessage("test-room-1", "zzzzzz"));

// function getChatIdForExplorer(explorerId: number) {
//   return generatePersonaUUID(explorerId).split("-")[0];
// }

// await chatClient.joinRoom("test-room-1");

// await chatClient.sendDirectMessage(getChatIdForExplorer(1071), "hi");

// const cli = createInterface({
//   input: process.stdin,
//   output: process.stdout,
// });

// // async onStep() {
// //   await cli.question("Press enter to continue...");
// // },
