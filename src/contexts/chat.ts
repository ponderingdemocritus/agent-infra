import {
  context,
  extension,
  formatInput,
  input,
  LogLevel,
  output,
  service,
} from "@daydreamsai/core";
import { z } from "zod";
import ChatClient, { type ChatMessage } from "../chat-client";
import { game_rules_and_directives } from "./game_rules";
import { player_context } from "./player";
import { game_loop } from "./player";
import { persona_context } from "./persona";
import { game_map_context } from "./game_map";
import { intentions_context } from "./intentions";
import { known_entities_context } from "./know_entities";

export function createChatService({
  token,
  username,
}: {
  token: string;
  username: string;
}) {
  return service({
    register(container) {
      container.singleton("eternum.chat", () => {
        console.log("creating chat client", token, username);
        return new ChatClient(token, username);
      });
    },
  });
}

const chat_context = context({
  type: "chat",
  schema: { id: z.string(), username: z.string() },
  key: ({ username }) => username,
  async setup(args, settings, agent) {
    return {
      client: agent.container.resolve<ChatClient>("eternum.chat"),
    };
  },
});

export const chat_global_context = context({
  type: "chat.global",
  schema: { playerId: z.number() },
  key: ({ playerId }) => playerId.toString(),
  instructions: `
  This context is used to send and receive messages to and from the chat server.
  `,
  async setup(args, settings, agent) {
    return {
      client: agent.container.resolve<ChatClient>("eternum.chat"),
    };
  },
  inputs: {
    "chat.message": input({
      schema: z.object({
        chat: z.object({
          id: z.string(),
          directMessage: z.boolean(),
          conversationId: z.string(),
          message: z.string(),
          sentUserId: z.string(),
          sentUserName: z.string(),
        }),
      }),

      subscribe(send, agent) {
        const chatClient = agent.container.resolve<ChatClient>("eternum.chat");

        chatClient.startMessageStream((data: ChatMessage<any>) => {
          const {
            userId,
            threadId,
            userName,
            directMessage,
            contentId,
            data: rawMessageData,
          } = data;

          const messageData = rawMessageData as {
            content: string;
            roomId?: string;
          };

          if (typeof messageData?.content !== "string") {
            console.warn("Received message without string content:", data);
            return;
          }

          if (!userId || !threadId || !userName || !contentId) {
            console.log("Skipping invalid message data:", data);
            return;
          }

          send(
            chat_global_context,
            { playerId: 18169 }, // TODO: get playerId from context, i don't think this matters for now
            {
              chat: {
                id: contentId,
                directMessage,
                conversationId: threadId,
                sentUserId: userId,
                sentUserName: userName,
                message: messageData.content,
              },
            }
          );
        });

        return () => {
          chatClient.stopMessageStream();
        };
      },
    }),
  },
})
  .setOutputs({
    "chat.direct.message": output({
      schema: z
        .object({
          recipientId: z.string().describe("The userId to send the message to"),
          content: z.string().describe("The content of the message to send"),
        })
        .describe("Use this to send a direct message to a specific user"),
      description:
        "Use this to send a direct message to a specific user. Always use this to send a direct message.",
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

        const chatClient = container.resolve<ChatClient>("eternum.chat");

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

    // "chat.roomMessage": output({
    //   schema: z
    //     .object({
    //       roomId: z.string().describe("The room ID to send the message to"),
    //       content: z.string().describe("The content of the message to send"),
    //     })
    //     .describe("use this to send a message to a specific room"),
    //   description:
    //     "Send a message to a specific room. Use this when you want to communicate with a group of people in the same chat room or channel.",
    //   enabled({ context }) {
    //     return context.type === chat_context.type;
    //   },
    //   handler: async (data, ctx, { container }) => {
    //     console.log("data", data);

    //     // Validate data
    //     if (!data.roomId || data.roomId.trim() === "") {
    //       console.error("Invalid roomId for room message");
    //       return {
    //         data: { ...data, error: "Invalid roomId" },
    //         timestamp: Date.now(),
    //       };
    //     }

    //     if (!data.content || data.content.trim() === "") {
    //       console.error("Empty content for room message");
    //       return {
    //         data: { ...data, error: "Empty content" },
    //         timestamp: Date.now(),
    //       };
    //     }

    //     const chatClient = container.resolve<ChatClient>("chat");

    //     const result = await chatClient.sendRoomMessage(
    //       data.roomId,
    //       data.content
    //     );

    //     if (!result.success) {
    //       console.error("Failed to send room message:", result.error);
    //     }

    //     return {
    //       data,
    //       timestamp: Date.now(),
    //     };
    //   },
    // }),

    // "chat.globalMessage": output({
    //   schema: z
    //     .object({
    //       content: z.string().describe("The content of the message to send"),
    //     })
    //     .describe("use this to send a global message to all users"),
    //   description:
    //     "Send a global message to all users. Use this sparingly for important information that everyone needs to know.",
    //   enabled({ context }) {
    //     return context.type === chat_context.type;
    //   },
    //   handler: async (data, ctx, { container }) => {
    //     console.log("data", data);

    //     // Validate data
    //     if (!data.content || data.content.trim() === "") {
    //       console.error("Empty content for global message");
    //       return {
    //         data: { ...data, error: "Empty content" },
    //         timestamp: Date.now(),
    //       };
    //     }

    //     const chatClient = container.resolve<ChatClient>("chat");

    //     const result = await chatClient.sendGlobalMessage(data.content);

    //     if (!result.success) {
    //       console.error("Failed to send global message:", result.error);
    //     }

    //     return {
    //       data,
    //       timestamp: Date.now(),
    //     };
    //   },
    // }),
  })

  .use(({ args }) => [
    { context: game_rules_and_directives, args: {} },
    { context: game_loop, args: {} },
    { context: persona_context, args: { playerId: args.playerId } },
    { context: player_context, args: { playerId: args.playerId } },
    { context: game_map_context, args: { playerId: args.playerId } },
    { context: known_entities_context, args: { playerId: args.playerId } },
    { context: intentions_context, args: { playerId: args.playerId } },
  ]);

export const chatExtension = extension({
  name: "chat",
  contexts: {
    chat: chat_global_context,
  },
});
