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
