export const EXPLORER_TROOPS_QUERY = `
  query explorerTroopsInRange($explorer_id: Int!) {
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
}
