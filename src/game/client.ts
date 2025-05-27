import { fetchGraphQL } from "@daydreamsai/core";
import {
  EXPLORER_TROOPS_QUERY,
  RESOURCES_QUERY,
  TILES_QUERY,
  TROOPS_BY_IDS_QUERY,
  TROOPS_IN_RANGE_QUERY,
  type Explorer,
  type GraphQLResponse,
  type ResourceBalances,
  type ResourceModel,
} from "./queries";
import { calculateStamina, getCurrentTick } from "./utils";
import { CENTER_OF_THE_MAP } from "../contexts/game_map";

import type { Account, Call } from "starknet";
import {
  troop_battle_systems,
  troop_movement_systems,
  troop_raid_systems,
} from "./extract";
import { TICKS } from "./types";

const torii_url = process.env.TORII_URL!;

async function client<T = any>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetchGraphQL<T>(torii_url + "/graphql", query, variables);
  if (res instanceof Error) {
    throw res;
  }
  return res;
}

const controller = {
  async move(account: Account, explorer_id: number, directions: number[]) {
    const moveCall: Call = {
      contractAddress: troop_movement_systems!,
      entrypoint: "explorer_move",
      calldata: [explorer_id, directions, 0],
    };

    const { transaction_hash } = await account.execute(moveCall);

    await account.waitForTransaction(transaction_hash);
  },

  async attackExporer(
    account: Account,
    explorer_id: number,
    defenderId: number,
    direction: number,
    stealableResources: { resourceId: number; amount: number }[]
  ) {
    const attackCall: Call = {
      contractAddress: troop_battle_systems!,
      entrypoint: "attack_explorer_vs_explorer",
      calldata: [
        explorer_id,
        defenderId,
        direction,
        stealableResources.length,
        ...stealableResources.flatMap(({ resourceId, amount }) => [
          resourceId,
          amount * 1_000_000_000,
        ]),
      ],
    };

    const { transaction_hash } = await account.execute(attackCall);

    await account.waitForTransaction(transaction_hash);
  },

  async attackStructure(
    account: Account,
    explorer_id: number,
    structure_id: number,
    direction: number
  ) {
    const attackCall: Call = {
      contractAddress: troop_battle_systems!,
      entrypoint: "attack_explorer_vs_guard",
      calldata: [explorer_id, structure_id, direction],
    };

    const { transaction_hash } = await account.execute(attackCall);

    await account.waitForTransaction(transaction_hash);
  },

  async raidStructure(
    account: Account,
    explorer_id: number,
    structure_id: number,
    direction: number,
    stealableResources: { resourceId: number; amount: number }[]
  ) {
    const raidCall: Call = {
      contractAddress: troop_raid_systems!,
      entrypoint: "raid_explorer_vs_guard",
      calldata: [
        explorer_id,
        structure_id,
        direction,
        stealableResources.length,
        ...stealableResources.flatMap(({ resourceId, amount }) => [
          resourceId,
          amount * 1_000_000_000,
        ]),
      ],
    };

    const { transaction_hash } = await account.execute(raidCall);

    await account.waitForTransaction(transaction_hash);
  },
};

function formatExplorer(explorer: Explorer) {
  const stamina = calculateStamina(
    explorer.troops.stamina,
    explorer.troops.category,
    explorer.troops.tier,
    getCurrentTick() / TICKS.Armies
  );

  const { category, tier, count } = explorer.troops;

  return {
    id: explorer.explorer_id,
    location: {
      x: explorer.coord.x - CENTER_OF_THE_MAP,
      y: explorer.coord.y - CENTER_OF_THE_MAP,
    },
    stamina: {
      current: stamina.current,
      max: stamina.max,
    },
    category,
    tier,
    troops: parseInt(count, 16) / 1_000_000_000,
  };
}

export const eternum = {
  controller,
  async getExplorer(explorer_id: number) {
    const res = await client<GraphQLResponse>(EXPLORER_TROOPS_QUERY, {
      explorer_id,
    });

    const troops = res.s1EternumExplorerTroopsModels!.edges.at(0);

    if (!troops) {
      throw new Error("Explorer not found!");
    }

    return formatExplorer(troops.node);
  },

  async getTileByOccupier(params: { occupier_id: number }) {
    const res = await client<GraphQLResponse>(TILES_QUERY, {
      where: params,
    });

    const tile = res.s1EternumTileModels!.edges.map((edge) => edge.node).at(0);

    if (tile) {
      return {
        ...tile,
        col: tile.col - CENTER_OF_THE_MAP,
        row: tile.row - CENTER_OF_THE_MAP,
      };
    }

    return tile;
  },

  async getTilesByRadius(params: {
    pos: { x: number; y: number };
    radius: number;
  }) {
    const radius = params.radius;

    const col = params.pos.x + CENTER_OF_THE_MAP;
    const row = params.pos.y + CENTER_OF_THE_MAP;

    const res = await client<GraphQLResponse>(TILES_QUERY, {
      where: {
        colGT: col - radius,
        colLT: col + radius,
        rowGT: row - radius,
        rowLT: row + radius,
      },
    });

    return res.s1EternumTileModels!.edges.map((edge) => {
      const tile = edge.node;
      return {
        ...tile,
        col: tile.col - CENTER_OF_THE_MAP,
        row: tile.row - CENTER_OF_THE_MAP,
      };
    });
  },

  async getTroopsByRadius(params: {
    pos: { x: number; y: number };
    radius: number;
  }) {
    const radius = params.radius;
    const col = params.pos.x + CENTER_OF_THE_MAP;
    const row = params.pos.y + CENTER_OF_THE_MAP;

    const res = await client<GraphQLResponse>(TROOPS_IN_RANGE_QUERY, {
      xMin: col - radius,
      xMax: col + radius,
      yMin: row - radius,
      yMax: row + radius,
    });

    return res.s1EternumExplorerTroopsModels!.edges.map((edge) =>
      formatExplorer(edge.node)
    );
  },

  async getTroopsByExplorers(params: { ids: number[] }) {
    const surroundingResponse = await client<GraphQLResponse>(
      TROOPS_BY_IDS_QUERY,
      {
        ids: params.ids,
      }
    );

    return surroundingResponse.s1EternumExplorerTroopsModels!.edges.map(
      (edge) => formatExplorer(edge.node)
    );
  },

  async getResources(entity_id: number) {
    const response = await client<GraphQLResponse>(RESOURCES_QUERY, {
      where: { entity_id },
    });

    return response.s1EternumResourceModels!.edges.map((edge) =>
      formatResources(edge.node)
    );
  },
};

export function formatResources(resources: ResourceModel<string>) {
  const { weight, entity_id, ...hexBalances } = resources;

  const { lords, ...balances } = Object.fromEntries(
    Object.entries(hexBalances)
      .filter(([v]) => !v.includes("_T")) // troops
      .map(([k, v]) => {
        return [
          k.includes("_BALANCE")
            ? k.slice(0, -"_BALANCE".length).toLowerCase()
            : k,
          typeof v === "string" && v.startsWith("0x") ? parseInt(v, 16) : v,
        ];
      })
  ) as ResourceBalances<number>;

  return {
    storage: {
      current: parseInt(weight.weight, 16),
      max: parseInt(weight.capacity, 16),
    },
    balances,
  };
}
