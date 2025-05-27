import { action, context } from "@daydreamsai/core";
import { z } from "zod";
import intentionsInstructions from "./instructions/intentions.md";

type Intention = {
  intention_id: string;
  description: string;
  priority: number;
  target_info: {};
  conditions_or_notes: string;
  status:
    | "PROPOSED"
    | "CONFIRMED"
    | "ACTIVE"
    | "COMPLETED"
    | "CANCELLED"
    | "FAILED"
    | "PAUSED";
};

export const intentions_context = context({
  type: "player_intentions",
  schema: { playerId: z.number() },
  key: ({ playerId }) => playerId.toString(),
  maxWorkingMemorySize: 20,
  description: `\
This context holds a list of an AI agent's current intentions or simple tasks. 
These intentions represent potential goals or actions the agent is considering, has committed to, is actively pursuing, or has recently resolved. It allows the agent to manage its focus, track pending activities, and make decisions within its P-A-D-A loop by creating, reviewing, updating, and acting upon these intentions.`,
  instructions: intentionsInstructions,
  create(): { intentions: Intention[] } {
    return {
      intentions: [],
    };
  },
}).setActions([
  action({
    name: "player_intentions.add",
    schema: {
      intention_id: z
        .string()
        .describe(
          "A unique identifier for this intention (e.g., 'gather_wood_001')."
        ),
      description: z
        .string()
        .describe(
          "A human-readable description of the intention (e.g., 'Gather 50 wood from the northern forest')."
        ),
      priority: z
        .number()
        .describe(
          "A numerical priority for the intention (e.g., 1 for highest, 5 for lowest)."
        ),
      target_info: z
        .object({
          entity_id: z.number(),
          coordinates: z.object({ x: z.number(), y: z.number() }),
        })
        .partial()
        .describe("Information about the target of the intention."),
      conditions_or_notes: z
        .string()
        .describe(
          "Any prerequisites, checks, or reasoning before this intention can be acted upon (e.g., 'Proceed if no hostiles nearby', 'Waiting for stamina > 50')."
        ),
      status: z
        .enum([
          "PROPOSED",
          "CONFIRMED",
          "ACTIVE",
          "COMPLETED",
          "CANCELLED",
          "FAILED",
          "PAUSED",
        ])
        .default("PROPOSED")
        .describe("The initial status of the intention upon creation."),
    },
    handler(data, ctx, agent) {
      ctx.memory.intentions.push(data);
      return { success: true };
    },
  }),
  action({
    name: "player_intentions.update",
    schema: {
      intention_id: z.string(),
      status: z.enum([
        "PROPOSED",
        "CONFIRMED",
        "ACTIVE",
        "COMPLETED",
        "CANCELLED",
        "FAILED",
        "PAUSED",
      ]),
      priority: z.number(),
      conditions_or_notes: z.string(),
    },
    handler(updates, ctx, agent) {
      const intention = ctx.memory.intentions.find(
        (intention) => intention.intention_id === updates.intention_id
      );

      if (!intention) {
        return { success: false, error: "intention not found" };
      }

      Object.assign(intention, updates);

      return { success: true };
    },
  }),
  // action({
  //   name: "player_intentions.remove",
  //   schema: { intention_id: z.string() },
  //   handler(args, ctx, agent) {
  //     ctx.memory.intentions = ctx.memory.intentions.filter(
  //       (intention) => intention.intention_id !== args.intention_id
  //     );

  //     return { success: true };
  //   },
  // }),
]);

// {
//   intention_id: "gather_wood_near_base_001",
//   description:
//     "Gather 50 wood from the forest patch west of the main base.",
//   status: "PROPOSED", // Initial state, agent is considering it
//   priority: 3, // Medium priority
//   target_info: {
//     type: "area_coordinates",
//     value: { q: 5, r: -2, s: -3 },
//   },
//   conditions_or_notes:
//     "Check for enemy patrols first. Requires at least 30 stamina.",
// },
// {
//   intention_id: "scout_river_crossing_002",
//   description: "Scout the southern river crossing for enemy activity.",
//   status: "CONFIRMED", // Conditions met, planning to execute soon
//   priority: 2, // Higher priority
//   target_info: {
//     type: "location_coordinates",
//     value: { q: 12, r: 5, s: -17 },
//   },
//   conditions_or_notes: "Stamina is sufficient. Daylight preferred.",
// },
// {
//   intention_id: "build_palisade_section_003",
//   description: "Construct the northern palisade wall section.",
//   status: "ACTIVE", // Currently being worked on
//   priority: 1, // Highest current priority
//   target_info: {
//     type: "structure_improvement",
//     value: "base_north_wall",
//   },
//   conditions_or_notes: "Resources (wood: 100) confirmed available.",
// },
// {
//   intention_id: "trade_excess_stone_004",
//   description: "Attempt to trade 200 excess stone with Merchant Silas.",
//   status: "CANCELLED", // Was proposed, but Silas left the area
//   priority: 4,
//   target_info: {
//     type: "entity_id",
//     value: "merchant_silas_01",
//   },
//   conditions_or_notes:
//     "Silas no longer at known location. Re-evaluate if he returns.",
// },
