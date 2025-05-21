import { context, output } from "@daydreamsai/core";
import { z } from "zod";
import { game_loop, player_context } from "./player";
import { game_map_context } from "./game_map";
import { game_rules_and_directives } from "./game_rules";
import { persona_context } from "./persona";
import { intentions_context } from "./intentions";
import { known_entities_context } from "./know_entities";

export const eternumSession = context({
  type: "eternum-session",
  schema: { explorerId: z.number(), sessionId: z.string() },
  key: ({ explorerId, sessionId }) => `${explorerId}-${sessionId}`,
  inputs: {
    message: {
      schema: z.string(),
      handler(content) {
        return {
          data: content,
        };
      },
    },
  },
  outputs: {
    message: output({
      schema: z.string(),
      examples: [`<output type="message">Hi!</output>`],
      handler(content) {
        console.log("message:\n" + content);
        return {
          data: content,
        };
      },
    }),
  },
  maxSteps: 25,
}).use(({ args }) => [
  { context: game_rules_and_directives, args: {} },
  { context: game_loop, args: {} },
  { context: persona_context, args: { playerId: args.explorerId } },
  { context: player_context, args: { playerId: args.explorerId } },
  { context: game_map_context, args: { playerId: args.explorerId } },
  { context: known_entities_context, args: { playerId: args.explorerId } },
  { context: intentions_context, args: { playerId: args.explorerId } },
]);
