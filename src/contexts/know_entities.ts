import { action, context } from "@daydreamsai/core";
import { z } from "zod";
import entitiesInstructions from "./instructions/know_entities.md";

type Entity = {
  id: number;
  type: string;
  last_know_location: { x: number; y: number };
  last_observed_timestamp: number;
  relationship: "hostile" | "neutral" | "ally" | "unknown" | "avoid";
  notes: string;
  tracking_priority: "high" | "medium" | "low";
};

export const known_entities_context = context({
  type: "known_entities",
  schema: { playerId: z.number() },
  key: ({ playerId }) => playerId.toString(),
  description: `\
This context serves as your (the AI agent's) curated dossier of other significant entities in the game world (e.g., other players, key NPCs, notable creature camps). You actively manage this list, deciding which entities to track, what information to store about them, and your personal notes or assessments. While the game system provides raw perception data, this context reflects _your_ persistent, strategic knowledge base about other actors.
`,
  instructions: entitiesInstructions,
  create(): {
    entities: Record<number, Partial<Entity>>;
  } {
    return {
      entities: {},
    };
  },
}).setActions([
  action({
    name: "known_entities.add_or_update",
    instructions: `\
You (the agent) use this action to consciously add a new entity to your known_entities context or to update the information you are storing about an entity you are already tracking. This action signifies your decision to commit specific information about an entity to your persistent, curated knowledge base.
When to use:
After perceiving a new entity that you deem important enough to track.
After gaining new, significant information about an entity you are already tracking (e.g., observed a change in their army, new location, change in behavior).
When you want to explicitly record your assessment or change your tracking priority for an entity.`,
    schema: {
      id: z.number(),
      relationship: z
        .enum(["hostile", "neutral", "ally", "unknown", "avoid"])
        .optional(),
      notes: z
        .string()
        .optional()
        .describe("Agent's personal notes about this entity"),
      tracking_priority: z
        .enum(["high", "medium", "low"])
        .optional()
        .describe("Agent's priority for tracking this entity."),
    },
    handler(args, ctx) {
      ctx.memory.entities[args.id] = {
        relationship: "unknown",
        tracking_priority: "low",
        ...ctx.memory.entities[args.id],
        ...args,
      };
    },
  }),
  action({
    name: "known_entities.remove",
    schema: {
      id: z.number(),
    },
    handler(args, ctx) {},
  }),
  action({
    name: "known_entities.update_notes",
    schema: {
      id: z.number(),
      notes: z.string(),
    },
    handler(args, ctx) {
      ctx.memory.entities[args.id].notes = args.notes;
    },
  }),
  action({
    name: "known_entities.subscribe_to_updates",
    schema: {
      id: z.number(),
    },
    handler(args, ctx) {},
  }),
  action({
    name: "known_entities.unsubscribe_from_updates",
    schema: {
      id: z.number(),
    },
    handler(args, ctx) {},
  }),
]);
