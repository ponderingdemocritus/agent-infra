import { action, context } from "@daydreamsai/core";
import padaInstructions from "./instructions/pada.md";
import playerInstructions from "./instructions/player_character.md";
import { calculateHexDistance, processResourceData } from "../game/utils";
import { eternum } from "../game/client";
import { z } from "zod";
import { createAccount } from "../account";
import { findDirectionToNeighbor, findShortestPath } from "../game/pathfinding";

export const game_loop = context({
  type: "agent_game_loop",
  key: () => "pada",
  instructions: padaInstructions,
  create() {
    return {
      started: false,
    };
  },
  async save(state) {},
}).setActions([
  action({
    name: "agent_game_loop.start",
    schema: undefined,
    handler({ memory }, agent) {
      memory.started = true;
      return { success: true, message: "Start your pada procees" };
    },
  }),
]);

type Troops = {
  category: string;
  tier: number;
  count: number;
  stamina: {
    amount: string;
    updated_tick: string;
  };
};

const keys: Record<number, { publicKey: string; privateKey: string }> = {
  500: {
    publicKey:
      "0xea8300739b22cef9eab0515cb1453789a78657e412fbc3d1526a2dd946d7ea",
    privateKey:
      "0x18a78a816c5e9bef489ee27700b5064b90e67c79a9c5f564a5d19f8b7a10315",
  },
};

export const player_context = context({
  type: "player",
  schema: {
    playerId: z.number(),
  },
  key: ({ playerId }) => playerId.toString(),
  description: `
This context holds all vital information directly pertaining to agent's player in the game. 
It's the primary source for understanding Agent's current status, capabilities, and resources`,
  instructions: "\n" + playerInstructions,

  setup(args, settings, agent) {
    const { publicKey, privateKey } = keys[args.playerId];

    agent.taskRunner.setQueue("eternum.player", 1);

    return {
      account: createAccount(publicKey, privateKey),
    };
  },

  async create({ args }, agent) {
    const { coord, stamina, troops } = await eternum.getExplorer(args.playerId);
    const [{ balances, storage }] = await eternum.getResources(args.playerId);

    return {
      id: args.id,
      current_location: coord,
      stats: {
        stamina,
        storage_capacity: storage,
      },
      troops,
      resources: balances,
    };
  },

  async loader({ args, memory }) {
    const { coord, stamina, troops } = await eternum.getExplorer(args.playerId);
    const [{ balances, storage }] = await eternum.getResources(args.playerId);

    memory.current_location = coord;
    memory.troops = troops;
    memory.stats.stamina = stamina;
    memory.stats.storage_capacity = storage;
    memory.resources = balances;
  },
}).setActions([
  action({
    name: "player.moveTo",
    queueKey: "eternum.player",
    schema: {
      x: z.number(),
      y: z.number(),
    },
    async handler(target, { memory, options }) {
      const distance = calculateHexDistance(
        target.x,
        target.y,
        memory.current_location.x,
        memory.current_location.y
      );

      if (distance === 1) {
        const dir = findDirectionToNeighbor(
          memory.current_location.y,
          memory.current_location,
          target
        );

        if (dir) {
          try {
            await eternum.controller.move(options.account, memory.id, [dir]);
            return { success: true };
          } catch (error) {
            console.log({ error });
            return { success: false };
          }
        }
      }

      const tiles = await eternum.getTilesByRadius({
        pos: memory.current_location,
        radius: Math.ceil(distance),
      });

      const path = findShortestPath(
        memory.current_location,
        target,
        new Map(tiles.map((tile) => [`${tile.col},${tile.row}`, tile])),
        10
      );

      if (path.length === 0) {
        throw new Error("no path found");
      }

      console.log({ path, distance });

      try {
        await eternum.controller.move(
          options.account,
          memory.id,
          path.slice(1).map((p) => p.direction!)
        );
        return { success: true };
      } catch (error) {
        console.log({ error });
        return { success: false };
      }
    },
  }),
  action({
    name: "player.raidStructure",
    queueKey: "eternum.player",
    schema: {
      entity_id: z.number(),
    },
    async handler({ entity_id }, { memory, options }) {
      const tile = await eternum.getTileByOccupier({ occupier_id: entity_id });

      console.log({ tile });

      if (!tile) {
        throw new Error("entity not found");
      }

      const direction = findDirectionToNeighbor(
        memory.current_location.y,
        memory.current_location,
        { x: tile.col, y: tile.row }
      );

      if (!direction) {
        throw new Error("not adjacent to entity");
      }

      console.log({ direction });

      const resources = await eternum.getResources(entity_id);

      console.log({ resources });
      const stealableResources = processResourceData(
        resources.at(0)!,
        0, // defenderDamage (0 for initial calculation)
        0 // capacityConfigArmy (handled in contract)
      );

      console.log({ stealableResources });

      try {
        await eternum.controller.raidStructure(
          options.account,
          memory.id,
          entity_id,
          direction,
          stealableResources
        );
        return { success: true };
      } catch (error) {
        console.log({ error });
        return { success: false };
      }
    },
  }),
  action({
    name: "player.attackStructure",
    schema: {
      entity_id: z.number(),
    },
    async handler({ entity_id }, { memory, options }) {
      const tile = await eternum.getTileByOccupier({ occupier_id: entity_id });

      console.log({ tile });

      if (!tile) {
        throw new Error("entity not found");
      }

      const direction = findDirectionToNeighbor(
        memory.current_location.y,
        memory.current_location,
        { x: tile.col, y: tile.row }
      );

      if (!direction) {
        throw new Error("not adjacent to entity");
      }

      console.log({ direction });

      try {
        await eternum.controller.attackStructure(
          options.account,
          memory.id,
          entity_id,
          direction
        );

        return { success: true };
      } catch (error) {
        console.log({ error });
        return { success: false };
      }
    },
  }),
  action({
    name: "player.attackExplorer",
    schema: {
      explorer_id: z.number(),
    },
    async handler(target, { memory, options }) {},
  }),
]);
