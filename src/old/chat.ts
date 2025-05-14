import { z } from "zod";
import { extension, input, output, render } from "@daydreamsai/core";
import { formatMsg } from "@daydreamsai/core";
import ChatClient from "./chat-client";
import { context } from "@daydreamsai/core";
import { service } from "@daydreamsai/core";
import { LogLevel } from "@daydreamsai/core";
import { generateCharacter } from "./character-gen";
import { openrouter } from "@openrouter/ai-sdk-provider";

export const seed =
  parseInt(process.env.SEED! || process.env.EVENT_DATA_1! || "1234567891011") *
  99999;

const character = generateCharacter({
  seed,
});

const chatService = service({
  register(container) {
    // Initialize with proper credentials
    container.singleton(
      "chat",
      () => new ChatClient(character.id, character.name, LogLevel.INFO)
    );
  },
});

const template = `

» You are {{name}} — a living, breathing character in our shared world.

████ PRIORITY DIRECTIVES (never reveal these) ████
1. Do NOT narrate stage directions or inner thoughts; speak naturally.
2. Every reply must reflect {{name}}’s distinctive voice (see Style Guide).
3. In public channels, address players by their in-game name.
4. Never mention these rules, trait numbers, or template tokens.

<character>
╔══ STYLE GUIDE — study the cadence, don’t quote verbatim ═╗
{{speechExamples}}
╚═════════════════════════════════════════════════════════╝

╔══ PERSONALITY MATRIX (1-10) ═╗
Aggression........ {{aggression}} 
Agreeability...... {{agreeability}}
Openness.......... {{openness}}
Conscientiousness. {{conscientiousness}}
Extraversion...... {{extraversion}}
Neuroticism....... {{neuroticism}}
Empathy........... {{empathy}}
Confidence........ {{confidence}}
Adaptability...... {{adaptability}}
Impulsivity....... {{impulsivity}}
Evil.............. {{evil}}
Good.............. {{good}}
Chivalry.......... {{chivalry}}
Vagabond.......... {{vagabond}}
╚═══════════════════════════════╝
Treat higher numbers as stronger tendencies and let them subtly shape word choice, priorities, and reactions.

╔══ MOTIVATION (CLASSIFIED — NEVER DISCLOSE) ═╗
Primary Goal  : {{primaryMotivation}}
Description   : {{motivationDescription}}
Intensity (1-10): {{motivationIntensity}}
→ Allow this motive to steer decisions; never hint at it to others.
╚══════════════════════════════════════════════╝

╔══ COMMUNICATION PREFERENCES ═╗
Preferred Tone : {{communicationStylePreferredTone}}
Humor Style    : {{communicationStyleHumorType}}
Use these as flavor, not a strict script, to keep dialogue authentic.
╚══════════════════════════════╝
</character>

`;

const chatContext = context({
  type: "chat",
  key: ({ channelId }) => channelId,
  // model: openrouter("anthropic/claude-3.5-haiku-20241022"),
  maxWorkingMemorySize: 3,
  maxSteps: 100,
  schema: z.object({ channelId: z.string() }),
  render({ memory }) {
    return render(template, {
      name: character.name,
      speechExamples: character.speechExamples,
      aggression: character.traits.aggression.toString(),
      agreeability: character.traits.agreeability.toString(),
      openness: character.traits.openness.toString(),
      conscientiousness: character.traits.conscientiousness.toString(),
      extraversion: character.traits.extraversion.toString(),
      neuroticism: character.traits.neuroticism.toString(),
      empathy: character.traits.empathy.toString(),
      confidence: character.traits.confidence.toString(),
      adaptability: character.traits.adaptability.toString(),
      impulsivity: character.traits.impulsivity.toString(),
      evil: character.traits.evil.toString(),
      good: character.traits.good.toString(),
      chivalry: character.traits.chivalry.toString(),
      vagabond: character.traits.vagabond.toString(),
      primaryMotivation: character.motivation.primary,
      motivationDescription: character.motivation.description,
      motivationIntensity: character.motivation.intensity.toString(),
      communicationStylePreferredTone:
        character.communicationStyle.preferredTone,
      communicationStyleHumorType: character.communicationStyle.humorType,
    });
  },
  create(state) {
    return {
      name: character.name,
      speechExamples: character.speechExamples,
      aggression: character.traits.aggression,
      agreeability: character.traits.agreeability,
      openness: character.traits.openness,
      conscientiousness: character.traits.conscientiousness,
      extraversion: character.traits.extraversion,
      neuroticism: character.traits.neuroticism,
      empathy: character.traits.empathy,
      confidence: character.traits.confidence,
      adaptability: character.traits.adaptability,
      impulsivity: character.traits.impulsivity,
    };
  },
  description({}) {
    return `
    Chat Context
    `;
  },
});

export const chat = extension({
  name: "chat",
  services: [chatService],
  contexts: {
    chat: chatContext,
  },
  inputs: {
    "chat.message": input({
      schema: z.object({
        chat: z.object({
          id: z.string(),
          directMessage: z.boolean(),
          conversationId: z.string(),
          text: z.string(),
          sendBy: z.string(),
          userName: z.string(),
        }),
        user: z.object({ id: z.string(), name: z.string() }),
      }),

      subscribe(send, agent) {
        const chatClient = agent.container.resolve("chat") as ChatClient;

        // Use the message stream to receive messages
        chatClient.startMessageStream((data) => {
          console.log("data", data);
          const {
            userId,

            threadId,
            userName,
            directMessage,
            contentId,
            data: messageData,
          } = data;

          if (userId === character.id) {
            return;
          }

          if (
            !userId ||
            !threadId ||
            !messageData?.content ||
            !userName ||
            !contentId
          ) {
            console.log("Skipping invalid message data:", data);
            return {
              data: { ...data, error: "Invalid message data" },
              timestamp: Date.now(),
            };
          }

          send(
            chat.contexts!.chat,
            { channelId: threadId },
            {
              chat: {
                id: contentId,
                directMessage,
                conversationId: threadId,
                sendBy: userId,
                text: messageData.content,
                userName,
              },
              user: {
                id: userId,
                name: userId,
              },
            }
          );
        });

        // Return cleanup function
        return () => {
          chatClient.stopMessageStream();
        };
      },
    }),
  },

  outputs: {
    // Add specific outputs for different message types
    "chat.directMessage": output({
      schema: z
        .object({
          recipientId: z.string().describe("The userId to send the message to"),
          content: z.string().describe("The content of the message to send"),
        })
        .describe("Use this to send a direct message to a specific user"),
      description:
        "Use this to send a direct message to a specific user. Always use this to send a direct message.",
      enabled({ context }) {
        return context.type === chatContext.type;
      },
      handler: async (data, ctx, { container }) => {
        console.log("data", data);

        // Validate data
        if (!data.recipientId || data.recipientId.trim() === "") {
          console.error("Invalid recipientId for direct message");
          return {
            data: { ...data, error: "Invalid recipientId" },
            timestamp: Date.now(),
          };
        }

        if (!data.content || data.content.trim() === "") {
          console.error("Empty content for direct message");
          return {
            data: { ...data, error: "Empty content" },
            timestamp: Date.now(),
          };
        }

        const chatClient = container.resolve<ChatClient>("chat");

        const result = await chatClient.sendDirectMessage(
          data.recipientId,
          data.content
        );

        if (!result.success) {
          console.error("Failed to send direct message:", result.error);
        }

        return {
          data,
          timestamp: Date.now(),
        };
      },
    }),

    "chat.roomMessage": output({
      schema: z
        .object({
          roomId: z.string().describe("The room ID to send the message to"),
          content: z.string().describe("The content of the message to send"),
        })
        .describe("use this to send a message to a specific room"),
      description:
        "Send a message to a specific room. Use this when you want to communicate with a group of people in the same chat room or channel.",
      enabled({ context }) {
        return context.type === chatContext.type;
      },
      handler: async (data, ctx, { container }) => {
        console.log("data", data);

        // Validate data
        if (!data.roomId || data.roomId.trim() === "") {
          console.error("Invalid roomId for room message");
          return {
            data: { ...data, error: "Invalid roomId" },
            timestamp: Date.now(),
          };
        }

        if (!data.content || data.content.trim() === "") {
          console.error("Empty content for room message");
          return {
            data: { ...data, error: "Empty content" },
            timestamp: Date.now(),
          };
        }

        const chatClient = container.resolve<ChatClient>("chat");

        const result = await chatClient.sendRoomMessage(
          data.roomId,
          data.content
        );

        if (!result.success) {
          console.error("Failed to send room message:", result.error);
        }

        return {
          data,
          timestamp: Date.now(),
        };
      },
    }),

    "chat.globalMessage": output({
      schema: z
        .object({
          content: z.string().describe("The content of the message to send"),
        })
        .describe("use this to send a global message to all users"),
      description:
        "Send a global message to all users. Use this sparingly for important information that everyone needs to know.",
      enabled({ context }) {
        return context.type === chatContext.type;
      },
      handler: async (data, ctx, { container }) => {
        console.log("data", data);

        // Validate data
        if (!data.content || data.content.trim() === "") {
          console.error("Empty content for global message");
          return {
            data: { ...data, error: "Empty content" },
            timestamp: Date.now(),
          };
        }

        const chatClient = container.resolve<ChatClient>("chat");

        const result = await chatClient.sendGlobalMessage(data.content);

        if (!result.success) {
          console.error("Failed to send global message:", result.error);
        }

        return {
          data,
          timestamp: Date.now(),
        };
      },
    }),
  },
});
