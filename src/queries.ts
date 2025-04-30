export const EXPLORER_TROOPS_QUERY = `
  query explorerTroopsInRange($explorer_id: u32!) {
    s1EternumExplorerTroopsModels(
      where: {explorer_id: $explorer_id}
      first: 1000
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

export const TROOPS_IN_RANGE_QUERY = `
  query troopsInRange($xMin: Int!, $xMax: Int!, $yMin: Int!, $yMax: Int!) {
    s1EternumExplorerTroopsModels(
      where: {coord: {xGT: $xMin, xLT: $xMax, yGT: $yMin, yLT: $yMax}}
      first: 1000
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

export const TILES_QUERY = `
  query tiles($colMin: Int!, $colMax: Int!, $rowMin: Int!, $rowMax: Int!) {
    s1EternumTileModels(
      where: {colGT: $colMin, colLT: $colMax, rowGT: $rowMin, rowLT: $rowMax}
      first: 1000
    ) {
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

export const RESOURCES_QUERY = `
  query entityResources($entity_id: u32!) {
    s1EternumResourceModels(
      where: {entity_id: $entity_id}
      first: 1000
    ) {
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

export interface GraphQLResponse {
  s1EternumExplorerTroopsModels: {
    edges: Array<{
      node: {
        explorer_id: number;
        coord: {
          x: number;
          y: number;
        };
        troops: {
          category: string;
          tier: number;
          count: number;
          stamina: {
            amount: string;
            updated_tick: string;
          };
        };
      };
    }>;
  };
  s1EternumTileModels?: {
    edges: Array<{
      node: {
        biome: number;
        col: number;
        row: number;
        occupier_id?: number;
      };
    }>;
  };
}
