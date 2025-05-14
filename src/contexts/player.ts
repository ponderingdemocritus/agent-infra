import { action, context } from "@daydreamsai/core";
import padaInstructions from "./instructions/pada.md";
import playerInstructions from "./instructions/player_character.md";
import {
  calculateHexDistance,
  getNeighborCoord,
  processResourceData,
} from "../game/utils";
import { eternum } from "../game/client";
import { z } from "zod";
import { createAccount, createNewAccount } from "../account";
import {
  findDirectionToNeighbor,
  findShortestPath,
  getHexDistance,
  type Position,
} from "../game/pathfinding";
import type { Account } from "starknet";

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

const explorerController = {
  async moveTo(
    account: Account,
    explorerId: number,
    pos: Position,
    target: Position
  ) {
    const distance = getHexDistance(pos, target);
    console.log({ distance });

    if (distance === 1) {
      const dir = findDirectionToNeighbor(pos.y, pos, target);
      if (dir) {
        try {
          await eternum.controller.move(account, explorerId, [dir]);
          return { success: true };
        } catch (error) {
          console.log({ error });
          return { success: false, error };
        }
      }
      console.log("no dir on distance 1");
    }

    const tiles = await eternum.getTilesByRadius({
      pos,
      radius: Math.ceil(distance) + 2,
    });

    const path = findShortestPath(
      pos,
      target,
      new Map(tiles.map((tile) => [`${tile.col},${tile.row}`, tile])),
      10
    );

    if (path.length < 1) {
      throw new Error("no path found");
    }

    console.log({ path, distance });

    try {
      await eternum.controller.move(
        account,
        explorerId,
        path.slice(1).map((p) => p.direction!)
      );
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
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

  async setup(args, settings, agent) {
    // FOR DEV
    const keys = {
      publicKey:
        "0x254300e8d78f9483ade1c69d57e95e55ec93c10a5d0f7c73ca0819b8be5cef1",
      privateKey:
        "0x3ef88a2dd8ed5967be2f900fe43627434d5ffb8420f2f904442c92bd6d88b49",
    };

    if (!keys) {
      throw new Error(
        `Key pair not found for playerId ${args.playerId}. Please add it to the keys map.`
      );
    }

    const { publicKey, privateKey } = keys;

    agent.taskRunner.setQueue("eternum.player", 1);

    if (process.env.RUNTIME == "DEV") {
      return {
        account: createAccount(publicKey, privateKey),
      };
    }

    return {
      account: await createNewAccount({ explorer_id: args.playerId }),
    };
  },

  async create({ args }, agent) {
    const { coord, stamina, troops } = await eternum.getExplorer(args.playerId);
    const [{ balances, storage }] = await eternum.getResources(args.playerId);

    return {
      id: args.playerId,
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
      return explorerController.moveTo(
        options.account,
        memory.id,
        memory.current_location,
        target
      );
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

      const resources = await eternum.getResources(entity_id);

      const stealableResources = processResourceData(
        resources.at(0)!,
        0, // defenderDamage (0 for initial calculation)
        0 // capacityConfigArmy (handled in contract)
      );

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

      // const distance = calculateHexDistance(
      //   memory.current_location.x,
      //   memory.current_location.y,
      //   tile.col,
      //   tile.row
      // );

      // if (distance > 1) {
      //   const res = await explorerController.moveTo(
      //     options.account,
      //     memory.id,
      //     memory.current_location,
      //     { x: tile.col, y: tile.row }
      //   );

      //   if (res.error) throw res.error;
      // }

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
    async handler({ explorer_id }, { memory, options }) {
      const tile = await eternum.getTileByOccupier({
        occupier_id: explorer_id,
      });

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

      const resources = await eternum.getResources(explorer_id);

      const stealableResources = processResourceData(
        resources.at(0)!,
        0, // defenderDamage (0 for initial calculation)
        0 // capacityConfigArmy (handled in contract)
      );

      console.log({ stealableResources });

      try {
        await eternum.controller.attackExporer(
          options.account,
          memory.id,
          explorer_id,
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
]);
