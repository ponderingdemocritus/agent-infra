import { z } from "zod";
import { extension, input, output } from "@daydreamsai/core";
import { formatMsg } from "@daydreamsai/core";
import ChatClient from "./chat-client";
import { context } from "@daydreamsai/core";
import { service } from "@daydreamsai/core";
import { LogLevel } from "@daydreamsai/core";
import { generateCharacter } from "./character-gen";

console.log("env", process.env);

// Define chat credentials interface
export interface ChatCredentials {
  token: string;
  username: string;
}

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

const chatContext = context({
  type: "chat",
  key: ({ channelId }) => channelId,
  schema: z.object({ channelId: z.string() }),

  description({}) {
    return `
    
    Your responses should reflect your character's personality traits, communication style, and motivations.
    
    CONTEXT INFORMATION:
    - You are communicating in a chat channel with ID: {channelId}
    - You can send direct messages, room messages, or global messages
    - Direct messages are private between you and another user
    - Room messages are sent to specific chat rooms
    - Global messages are broadcast to all users
    
    MESSAGE TYPES:
    - Use "chat:directMessage" when responding privately to a specific user
    - Use "chat:roomMessage" when speaking in a specific room
    - Use "chat:globalMessage" when broadcasting to everyone
    
    IMPORTANT GUIDELINES:
    - Stay in character at all times
    - Consider the context and history of the conversation
    - Be responsive to the tone and content of incoming messages
    - Provide helpful and engaging responses
    - Only respond to messages that are relevant
    
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
        }),
        user: z.object({ id: z.string(), name: z.string() }),
      }),
      format: ({ user, chat }) =>
        formatMsg({
          role: "user",
          user: user.name,
          content: chat.text,
        }),
      subscribe(send, { container }) {
        const chatClient = container.resolve<ChatClient>("chat");

        // Use the message stream to receive messages
        chatClient.startMessageStream((data) => {
          const {
            userId,
            platformId,
            threadId,
            directMessage,
            contentId,
            data: messageData,
          } = data;

          if (userId === character.id) {
            return;
          }

          if (!userId || !threadId || !messageData?.content) {
            console.log("Skipping invalid message data:", data);
            return;
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
      format: ({ data }) =>
        formatMsg({
          role: "assistant",
          content: data.content,
        }),
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
      format: ({ data }) =>
        formatMsg({
          role: "assistant",
          content: data.content,
        }),
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
      format: ({ data }) =>
        formatMsg({
          role: "assistant",
          content: data.content,
        }),
    }),
  },
});
