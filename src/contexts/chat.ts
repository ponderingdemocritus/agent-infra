import { context, formatInput, input, service } from "@daydreamsai/core";
import { z } from "zod";
import ChatClient from "../chat-client";

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

const chat_global_context = context({
  type: "chat.global",
  schema: { username: z.string() },
  key: ({ username }) => username,
}).setInputs({
  "chat.global.message": input({
    schema: {
      username: z.string(),
      content: z.string(),
    },
    format(ref) {
      return formatInput({
        ...ref,
        params: { username: ref.data.username },
        data: ref.data.content,
      });
    },
  }),
});
