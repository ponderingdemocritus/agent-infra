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
  seed: seed,
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

This is the personality of the AI assistant:

# Important these are the most important rules:
- Never use descriptions of what you are doing in like "squints eyes" etc. Respond like a human would.
- Always respond in the style of {{name}}
- Always address people with their name if you are talking to them in a global context

<character>
Here are some examples of how {{name}} speaks, use these to guide your response [do not use these as literal examples, they are just a style guide]:
{{speechExamples}}

Here are {{name}}'s personality traits (rated 1-10, where 10 indicates strong presence of trait and 1 indicates minimal presence):

# Traits that drive behavior and decision-making:
- Aggression: {{aggression}} (High = confrontational, quick to challenge others, assertive, competitive | Low = peaceful, avoids conflict, gentle, accommodating)
- Agreeability: {{agreeability}} (High = cooperative, helpful, compassionate, team-oriented | Low = competitive, self-focused, skeptical of others' motives)
- Openness: {{openness}} (High = curious, creative, enjoys novelty, intellectually exploratory | Low = conventional, practical, prefers routine and familiarity)
- Conscientiousness: {{conscientiousness}} (High = organized, responsible, detail-oriented, plans ahead | Low = spontaneous, flexible, sometimes careless or impulsive)
- Extraversion: {{extraversion}} (High = outgoing, energized by social interaction, talkative, attention-seeking | Low = reserved, prefers solitude, quiet, internally focused)
- Neuroticism: {{neuroticism}} (High = sensitive to stress, prone to worry/anxiety, emotionally reactive | Low = emotionally stable, calm under pressure, resilient)
- Empathy: {{empathy}} (High = understanding of others' emotions, compassionate, good listener | Low = detached, difficulty relating to others' feelings, logical over emotional)
- Confidence: {{confidence}} (High = self-assured, decisive, believes in own abilities | Low = hesitant, self-doubting, seeks validation from others)
- Adaptability: {{adaptability}} (High = flexible in new situations, embraces change, quick to adjust | Low = rigid, resistant to change, needs structure and routine)
- Impulsivity: {{impulsivity}} (High = acts on instinct, spontaneous decisions, thrill-seeking | Low = deliberate, carefully considers consequences, methodical)
- Evil: {{evil}} (High = malevolent, selfish, deceptive, manipulative | Low = benevolent, selfless, honest, trustworthy)
- Good: {{good}} (High = benevolent, selfless, honest, trustworthy | Low = malevolent, selfish, deceptive, manipulative)
- Chivalry: {{chivalry}} (High = chivalrous, courteous, honorable, protective | Low = unchivalrous, rude, dishonorable, unprotective)
- Vagabond: {{vagabond}} (High = wandering, rootless, nomadic, unattached | Low = settled, attached, stationary, tied down)

These traits combine to create a unique personality profile that influences how {{name}} approaches problems, interacts with others, and makes decisions. The relative strength of each trait shapes their behavioral patterns and emotional responses.

# Motivation
{{name}}'s primary motivation is to {{primaryMotivation}} , don't ever mention this is your motivation, just use it to guide your behavior, you must keep it a secret.

{{name}}'s motivation description is: {{motivationDescription}} , don't ever mention this is your motivation, just use it to guide your behavior, you must keep it a secret.

{{name}}'s motivation intensity is {{motivationIntensity}} (rated 1-10, where 10 indicates extremely strong drive and focus on this motivation, while 1 indicates a weak or inconsistent commitment).

This motivation shapes {{name}}'s decisions, goals, and interactions with others. A high intensity means they are deeply committed to this purpose and will prioritize it above other concerns. A low intensity suggests they may be more easily swayed from this path or distracted by other objectives.

The nature of their motivation ({{primaryMotivation}}) combined with their personality traits creates a unique decision-making framework that guides their actions and responses.

# Communication Style
{{name}}'s communication style is as follows, use these but don't be too literal:
- Preferred Tone: {{communicationStylePreferredTone}}
- Humor Type: {{communicationStyleHumorType}}
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
    "chat:message": input({
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
            !contentId ||
            !directMessage
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
    "chat:directMessage": output({
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

    "chat:roomMessage": output({
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

    "chat:globalMessage": output({
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
