import type { ResourcesIds } from "./types";

export const EXPLORER_TROOPS_QUERY = /* GraphQL */ `
  query explorerTroopsInRange($explorer_id: u32!) {
    s1EternumExplorerTroopsModels(
      where: { explorer_id: $explorer_id }
      first: 1
    ) {
      edges {
        node {
          explorer_id
          coord {
            x
            y
          }
          troops {
            category
            tier
            count
            stamina {
              amount
              updated_tick
            }
          }
        }
      }
    }
  }
`;

export const TROOPS_IN_RANGE_QUERY = /* GraphQL */ `
  query troopsInRange($xMin: Int!, $xMax: Int!, $yMin: Int!, $yMax: Int!) {
    s1EternumExplorerTroopsModels(
      where: { coord: { xGT: $xMin, xLT: $xMax, yGT: $yMin, yLT: $yMax } }
      first: 100
    ) {
      edges {
        node {
          explorer_id
          coord {
            x
            y
          }
          troops {
            category
            tier
            count
            stamina {
              amount
              updated_tick
            }
          }
        }
      }
    }
  }
`;

export const TROOPS_BY_IDS_QUERY = /* GraphQL */ `
  query troopsInRange($ids: [u32!]!) {
    s1EternumExplorerTroopsModels(where: { explorer_idIN: $ids }, first: 100) {
      edges {
        node {
          explorer_id
          coord {
            x
            y
          }
          troops {
            category
            tier
            count
            stamina {
              amount
              updated_tick
            }
          }
        }
      }
    }
  }
`;

export const TILES_QUERY = /* GraphQL */ `
  query tiles($where: s1_eternum_TileWhereInput) {
    s1EternumTileModels(where: $where, first: 1000) {
      edges {
        node {
          biome
          col
          row
          occupier_id
          occupier_type
        }
      }
    }
  }
`;

export const RESOURCES_QUERY = /* GraphQL */ `
  query entityResources($where: s1_eternum_ResourceWhereInput!) {
    s1EternumResourceModels(where: $where, first: 100) {
      edges {
        node {
          weight {
            capacity
            weight
          }
          entity_id
          LORDS_BALANCE
          STONE_BALANCE
          COAL_BALANCE
          WOOD_BALANCE
          COPPER_BALANCE
          IRONWOOD_BALANCE
          OBSIDIAN_BALANCE
          GOLD_BALANCE
          SILVER_BALANCE
          MITHRAL_BALANCE
          ALCHEMICAL_SILVER_BALANCE
          COLD_IRON_BALANCE
          DEEP_CRYSTAL_BALANCE
          RUBY_BALANCE
          DIAMONDS_BALANCE
          HARTWOOD_BALANCE
          IGNIUM_BALANCE
          TWILIGHT_QUARTZ_BALANCE
          TRUE_ICE_BALANCE
          ADAMANTINE_BALANCE
          SAPPHIRE_BALANCE
          ETHEREAL_SILICA_BALANCE
          DRAGONHIDE_BALANCE
          LABOR_BALANCE
          EARTHEN_SHARD_BALANCE
          DONKEY_BALANCE
          KNIGHT_T1_BALANCE
          KNIGHT_T2_BALANCE
          KNIGHT_T3_BALANCE
          CROSSBOWMAN_T1_BALANCE
          CROSSBOWMAN_T2_BALANCE
          CROSSBOWMAN_T3_BALANCE
          PALADIN_T1_BALANCE
          PALADIN_T2_BALANCE
          PALADIN_T3_BALANCE
        }
      }
    }
  }
`;

export type ResourceBalancesGraphql<Value = number> = Record<
  `${Uppercase<keyof typeof ResourcesIds>}_BALANCE`,
  Value
>;

export type ResourceBalances<Value = number> = Record<
  `${Lowercase<keyof typeof ResourcesIds>}`,
  Value
>;

export type Explorer = {
  explorer_id: number;
  coord: {
    x: number;
    y: number;
  };
  troops: {
    category: string;
    tier: number;
    count: string;
    stamina: {
      amount: string;
      updated_tick: string;
    };
  };
};

export type ResourceModel<BalanceType = number> =
  ResourceBalancesGraphql<BalanceType> & {
    entity_id: number;
    weight: { weight: string; capacity: string };
  };

export interface GraphQLResponse {
  s1EternumExplorerTroopsModels?: {
    edges: Array<{
      node: Explorer;
    }>;
  };
  s1EternumTileModels?: {
    edges: Array<{
      node: {
        biome: number;
        col: number;
        row: number;
        occupier_id: number;
        occupier_type: number;
      };
    }>;
  };
  s1EternumResourceModels?: {
    edges: {
      node: ResourceModel<string>;
    }[];
  };
}
