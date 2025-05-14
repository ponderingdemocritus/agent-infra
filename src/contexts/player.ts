import { action, context, type AnyAgent } from "@daydreamsai/core";
import padaInstructions from "./instructions/pada.md";
import playerInstructions from "./instructions/player_character.md";
import { processResourceData, WORLD_CONFIG } from "../game/utils";
import { eternum } from "../game/client";
import { z } from "zod";
import { createAccount, createNewAccount } from "../game/account";
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

type Wallet = {
  publicKey: string;
  privateKey: string;
};

async function getExplorerAccount({
  agent,
  explorer_id,
}: {
  agent: AnyAgent;
  explorer_id: number;
}) {
  const keys = await agent.memory.store.get<Wallet>(
    `eternum.wallet.${explorer_id}`
  );

  if (keys) return createAccount(keys.publicKey, keys.privateKey);

  console.log("creating new account");

  const { account, publicKey, privateKey } = await createNewAccount({
    explorer_id,
  });

  await agent.memory.store.set(`eternum.wallet.${explorer_id}`, {
    publicKey,
    privateKey,
  });

  return account;
}

const explorerController = {
  async moveTo({
    account,
    explorerId,
    stamina,
    pos,
    target,
  }: {
    account: Account;
    explorerId: number;
    stamina: number;
    pos: Position;
    target: Position;
  }) {
    const distance = getHexDistance(pos, target);

    if (distance === 0)
      return { success: true, message: "Already in the tile" };

    console.log({ stamina, distance });

    const minStaminaCost =
      WORLD_CONFIG.troop_stamina_config.stamina_travel_stamina_cost * distance;

    if (stamina < minStaminaCost) {
      throw new Error(
        "not enough stamina for that distance, mininum cost: " +
          minStaminaCost +
          "\nUse shorter distances to move"
      );
    }

    if (distance === 1) {
      const dir = findDirectionToNeighbor(pos.y, pos, target);
      if (dir !== null) {
        try {
          await eternum.controller.move(account, explorerId, [dir]);
          return { success: true };
        } catch (error) {
          console.log({ error });
          return { success: false, error };
        }
      }
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
    agent.taskRunner.setQueue("eternum.player", 1);

    return {
      account: await getExplorerAccount({ agent, explorer_id: args.playerId }),
    };
  },

  async create({ args }, agent) {
    const { location, stamina, category, tier, troops } =
      await eternum.getExplorer(args.playerId);
    const [{ balances, storage }] = await eternum.getResources(args.playerId);

    return {
      id: args.playerId,
      current_location: location,
      stats: {
        stamina,
        storage_capacity: storage,
      },
      category,
      tier,
      troops,
      resources: balances,
    };
  },

  async loader({ args, memory }) {
    const { location, stamina, troops } = await eternum.getExplorer(
      args.playerId
    );
    const [{ balances, storage }] = await eternum.getResources(args.playerId);

    memory.current_location = location;
    memory.troops = troops;
    memory.stats.stamina = stamina;
    memory.stats.storage_capacity = storage;
    memory.resources = balances;
  },
}).setActions([
  action({
    name: "player.moveTo",
    instructions: `\
Travel costs ${WORLD_CONFIG.troop_stamina_config.stamina_travel_stamina_cost} per hex.
`,
    queueKey: "eternum.player",
    schema: {
      x: z.number(),
      y: z.number(),
    },
    async handler(target, { memory, options }) {
      const res = await explorerController.moveTo({
        account: options.account,
        explorerId: memory.id,
        pos: memory.current_location,
        target,
        stamina: memory.stats.stamina.current,
      });

      if (res.success) {
        memory.current_location = target;
      }

      return res;
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

      if (direction === null) {
        throw new Error("not adjacent to entity");
      }

      const resources = await eternum.getResources(entity_id);

      const stealableResources = processResourceData(
        resources.at(0)!,
        0, // defenderDamage (0 for initial calculation)
        0 // capacityConfigArmy (handled in contract)
      );

      console.log({
        stealing: stealableResources,
      });

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
        return { success: false, error };
      }
    },
  }),
  action({
    name: "player.attackStructure",
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

      console.log({ direction });

      if (direction === null) {
        throw new Error("not adjacent to entity");
      }

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
        return { success: false, error };
      }
    },
  }),
  action({
    name: "player.attackExplorer",
    queueKey: "eternum.player",
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

      console.log({ direction });

      if (direction === null) {
        throw new Error("not adjacent to entity");
      }

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
        return { success: false, error };
      }
    },
  }),
]);
