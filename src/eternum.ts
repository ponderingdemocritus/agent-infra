import { z } from "zod";
import {
  action,
  extension,
  fetchGraphQL,
  input,
  output,
  render,
} from "@daydreamsai/core";
import { formatMsg } from "@daydreamsai/core";
import { context } from "@daydreamsai/core";
import { service } from "@daydreamsai/core";
import type { ServiceProvider } from "@daydreamsai/core";
import { LogLevel } from "@daydreamsai/core";
import { Account, RpcProvider, type Call } from "starknet";
import {
  getContract,
  troop_battle_systems,
  troop_movement_systems,
} from "./extract";

interface GraphQLResponse {
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

interface StaminaValue {
  amount: string;
  updated_tick: string;
}

// Tick configuration
const TICKS = {
  Armies: 15, // Armies tick in seconds (example value)
  Default: 1,
};

// Troop types enum to match the game
enum TroopType {
  Knight = 0,
  Crossbowman = 1,
  Paladin = 2,
}

// Biome types for stamina calculation
enum BiomeType {
  Ocean = 0,
  DeepOcean = 1,
  Beach = 2,
  Grassland = 3,
  Shrubland = 4,
  SubtropicalDesert = 5,
  TemperateDesert = 6,
  TropicalRainForest = 7,
  TropicalSeasonalForest = 8,
  TemperateRainForest = 9,
  TemperateDeciduousForest = 10,
  Tundra = 11,
  Taiga = 12,
  Snow = 13,
  Bare = 14,
  Scorched = 15,
}

// Configuration for troops
const TROOP_STAMINA_CONFIG = {
  Knight: {
    staminaInitial: 100,
    staminaMax: 200,
  },
  Crossbowman: {
    staminaInitial: 100,
    staminaMax: 200,
  },
  Paladin: {
    staminaInitial: 100,
    staminaMax: 200,
  },
};

// World configuration (would ideally come from the blockchain)
const WORLD_CONFIG = {
  troop_stamina_config: {
    stamina_gain_per_tick: 1, // Stamina gained per tick
    stamina_initial: 100, // Initial stamina
    stamina_bonus_value: 10, // Bonus/penalty for biome effects
    stamina_travel_stamina_cost: 30, // Base cost for travel
    stamina_explore_stamina_cost: 20, // Cost for exploration
  },
};

// Get the troop type from string
function getTroopType(category: string): TroopType {
  switch (category) {
    case "Knight":
      return TroopType.Knight;
    case "Crossbowman":
      return TroopType.Crossbowman;
    case "Paladin":
      return TroopType.Paladin;
    default:
      return TroopType.Knight; // Default fallback
  }
}

// Get travel stamina cost based on biome and troop type
function getTravelStaminaCost(biome: BiomeType, troopType: TroopType): number {
  const baseStaminaCost =
    WORLD_CONFIG.troop_stamina_config.stamina_travel_stamina_cost;
  const biomeBonus = WORLD_CONFIG.troop_stamina_config.stamina_bonus_value;

  // Biome-specific modifiers per troop type
  switch (biome) {
    case BiomeType.Ocean:
    case BiomeType.DeepOcean:
      return baseStaminaCost - biomeBonus; // -10 for all troops
    case BiomeType.Beach:
      return baseStaminaCost; // No modifier
    case BiomeType.Grassland:
    case BiomeType.Shrubland:
    case BiomeType.SubtropicalDesert:
    case BiomeType.TemperateDesert:
    case BiomeType.Tundra:
    case BiomeType.Bare:
      return (
        baseStaminaCost + (troopType === TroopType.Paladin ? -biomeBonus : 0)
      );
    case BiomeType.TropicalRainForest:
    case BiomeType.TropicalSeasonalForest:
    case BiomeType.TemperateRainForest:
    case BiomeType.TemperateDeciduousForest:
    case BiomeType.Taiga:
    case BiomeType.Snow:
      return (
        baseStaminaCost + (troopType === TroopType.Paladin ? biomeBonus : 0)
      );
    case BiomeType.Scorched:
      return baseStaminaCost + biomeBonus;
    default:
      return baseStaminaCost;
  }
}

// Enhanced stamina calculation based on the provided code
function calculateStamina(
  staminaValue: StaminaValue,
  troopCategory: string,
  currentTick: number
): {
  amount: number;
  updated_tick: number;
  maxStamina: number;
  staminaCostForTravel: number;
  staminaCostForExplore: number;
} {
  // Convert hex strings to numbers
  const amount = parseInt(staminaValue.amount, 16);
  const updatedTick = parseInt(staminaValue.updated_tick, 16);

  // Get troop type
  const troopType = getTroopType(troopCategory);

  // Get max stamina for this troop type
  const troopConfig = TROOP_STAMINA_CONFIG[
    troopCategory as keyof typeof TROOP_STAMINA_CONFIG
  ] || {
    staminaInitial: WORLD_CONFIG.troop_stamina_config.stamina_initial,
    staminaMax: 200,
  };
  const maxStamina = troopConfig.staminaMax;

  // Stamina gain per tick from config
  const staminaGainPerTick =
    WORLD_CONFIG.troop_stamina_config.stamina_gain_per_tick;

  // If current tick is less than or equal to updated tick, return current values
  if (currentTick <= updatedTick) {
    return {
      amount,
      updated_tick: updatedTick,
      maxStamina,
      staminaCostForTravel:
        WORLD_CONFIG.troop_stamina_config.stamina_travel_stamina_cost,
      staminaCostForExplore:
        WORLD_CONFIG.troop_stamina_config.stamina_explore_stamina_cost,
    };
  }

  // Calculate refill
  const numTicksPassed = currentTick - updatedTick;
  const totalStaminaSinceLastTick = numTicksPassed * staminaGainPerTick;
  const newAmount = Math.min(amount + totalStaminaSinceLastTick, maxStamina);

  // Get standard costs for travel and explore
  const staminaCostForTravel =
    WORLD_CONFIG.troop_stamina_config.stamina_travel_stamina_cost;
  const staminaCostForExplore =
    WORLD_CONFIG.troop_stamina_config.stamina_explore_stamina_cost;

  return {
    amount: newAmount,
    updated_tick: currentTick,
    maxStamina,
    staminaCostForTravel,
    staminaCostForExplore,
  };
}

// Function to fetch the current game tick
async function fetchCurrentTick(): Promise<number> {
  // This is a placeholder, ideally you would get this from the blockchain or an API
  // For testing, we can return a large number to simulate the current tick
  const currentTimestamp = Math.floor(Date.now() / 1000);
  // Convert timestamp to game ticks (assuming armies tick is 15 seconds)
  return Math.floor(currentTimestamp / TICKS.Armies);
}

const account_address =
  "0x01BFC84464f990C09Cc0e5D64D18F54c3469fD5c467398BF31293051bAde1C39";
const private_key =
  "0x075362a844768f31c8058ce31aec3dd7751686440b4f220f410ae0c9bf042e60";
const rpc_url =
  "https://starknet-sepolia.blastapi.io/de586456-fa13-4575-9e6c-b73f9a88bc97/rpc/v0_7";

const torii_url = "https://api.cartridge.gg/x/eternum-sepolia/torii/graphql";

const explorer_id = parseInt(process.env.EVENT_DATA_1 || "190");

const rpc = new RpcProvider({
  nodeUrl: rpc_url,
});

const account = new Account(rpc, account_address, private_key);

const EXPLORER_TROOPS_QUERY = `
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

const TROOPS_IN_RANGE_QUERY = `
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

const template = `
    You are explorer ${explorer_id}.

    <goal>
    You should move around the map to discover new areas
    </goal>

    You are currently at coordinates x: {x}, y: {y}.

    You should always check where you are on the map.

    If you hit an unexplored hex, you cannot move there. Just try a different direction.

    You are on a hexagon map.

    You can move in the following directions:
    0: Up
    1: Up-Right
    2: Down-Right
    3: Down
    4: Down-Left
    5: Up-Left

    Try to move around the map to discover new areas.

    You can attack other explorers or structures, and you should try to do so if you think you can win.

    Eternum Context`;

const eternumContext = context({
  type: "eternum",
  key: ({ channelId }) => channelId,
  schema: z.object({ channelId: z.string() }),

  async setup(args, { container }) {
    return { channelId: args.channelId };
  },

  create(state) {
    return {
      x: 0,
      y: 0,
      processedTroops: {},
    };
  },

  render({ memory }) {
    return render(template, {
      x: memory.x,
      y: memory.y,
      processedTroops: memory.processedTroops,
    });
  },

  description({}) {
    return `Eternum Context`;
  },
});

export const eternum = extension({
  name: "eternum",
  contexts: {
    eternum: eternumContext,
  },
  inputs: {
    "recurring:trigger": input({
      schema: z.object({
        timestamp: z.number(),
        message: z.string(),
      }),
      format: ({ timestamp }) =>
        `Recurring task triggered at ${new Date(timestamp).toISOString()}`,
      // Subscribe to timer events
      async subscribe(send) {
        const intervalMs = 3 * 60 * 1000;
        console.log(
          `Setting up recurring task to run every ${intervalMs / 1000} seconds`
        );

        // Create interval to trigger the agent every 5 minutes
        const intervalId = setInterval(() => {
          console.log(
            `Triggering recurring task at ${new Date().toISOString()}`
          );

          send(
            eternumContext,
            { channelId: "eternum" },
            {
              timestamp: Date.now(),
              message: "Complete your mission",
            }
          );
        }, intervalMs);

        // Return cleanup function
        return () => {
          clearInterval(intervalId);
        };
      },
    }),
  },
  actions: [
    action({
      name: "getStaminaInfo",
      description:
        "Get the current stamina information for the explorer's troops",
      schema: z.object({}),
      async handler(call, ctx, agent) {
        // Get current troops information
        const response = await fetchGraphQL<GraphQLResponse>(
          torii_url,
          EXPLORER_TROOPS_QUERY,
          {
            explorer_id: explorer_id,
          }
        );

        if (response instanceof Error) {
          throw response;
        }

        const nodeData = response.s1EternumExplorerTroopsModels.edges[0]?.node;

        if (!nodeData || !nodeData.troops) {
          return { result: "No troops found" };
        }

        // Fetch current tick
        const currentTick = await fetchCurrentTick();

        // Process the single troop
        const troop = nodeData.troops;
        const calculatedStamina = calculateStamina(
          troop.stamina,
          troop.category,
          currentTick
        );

        const staminaInfo = {
          category: troop.category,
          tier: troop.tier,
          count: troop.count,
          stamina: calculatedStamina,
          percentFull: Math.round(
            (calculatedStamina.amount / calculatedStamina.maxStamina) * 100
          ),
          canTravel:
            calculatedStamina.amount >= calculatedStamina.staminaCostForTravel,
          canExplore:
            calculatedStamina.amount >= calculatedStamina.staminaCostForExplore,
        };

        return {
          result: staminaInfo,
        };
      },
    }),
    action({
      name: "getTroopsInRange",
      description: "Get all troops within 20 units of the current position",
      schema: z.object({}),
      async handler(call, ctx, agent) {
        // First get current position
        const positionResponse = await fetchGraphQL<GraphQLResponse>(
          torii_url,
          EXPLORER_TROOPS_QUERY,
          {
            explorer_id: explorer_id,
          }
        );

        if (positionResponse instanceof Error) {
          throw positionResponse;
        }

        const { x, y } =
          positionResponse.s1EternumExplorerTroopsModels.edges[0]?.node.coord;

        // Now search for troops in range
        const response = await fetchGraphQL<GraphQLResponse>(
          torii_url,
          TROOPS_IN_RANGE_QUERY,
          {
            xMin: x - 20,
            xMax: x + 20,
            yMin: y - 20,
            yMax: y + 20,
          }
        );

        if (response instanceof Error) {
          throw response;
        }

        return {
          result:
            response.s1EternumExplorerTroopsModels.edges.map(
              (edge) => edge.node
            ) || [],
        };
      },
    }),
    action({
      name: "getExplorerTroops",
      description: "Get the current explorer's troops and location",
      schema: z.object({}),
      async handler(call, ctx, agent) {
        const response = await fetchGraphQL<GraphQLResponse>(
          torii_url,
          EXPLORER_TROOPS_QUERY,
          {
            explorer_id: explorer_id,
          }
        );

        if (response instanceof Error) {
          throw response;
        }

        const { x, y } =
          response.s1EternumExplorerTroopsModels.edges[0]?.node.coord;

        // Get node data
        const nodeData = response.s1EternumExplorerTroopsModels.edges[0]?.node;

        if (!nodeData) {
          return { result: null };
        }

        // Fetch current tick
        const currentTick = await fetchCurrentTick();

        // Process troops - ensure troops is treated as a single object
        const troop = nodeData.troops;
        const calculatedStamina = calculateStamina(
          troop.stamina,
          troop.category,
          currentTick
        );

        const processedTroop = {
          ...troop,
          calculatedStamina: {
            ...calculatedStamina,
            percentFull: Math.round(
              (calculatedStamina.amount / calculatedStamina.maxStamina) * 100
            ),
            canTravel:
              calculatedStamina.amount >=
              calculatedStamina.staminaCostForTravel,
            canExplore:
              calculatedStamina.amount >=
              calculatedStamina.staminaCostForExplore,
          },
        };

        const memory = ctx.agentMemory;
        memory.x = x;
        memory.y = y;

        // Return the processed data
        return {
          result: {
            explorer_id: nodeData.explorer_id,
            coord: nodeData.coord,
            troops: processedTroop,
          },
        };
      },
    }),
    action({
      name: "moveExplorer",
      description: "Move the explorer to a new position",
      schema: z.object({
        direction: z
          .number()
          .array()
          .describe(
            "Direction to move the explorer. 0: Up, 1: Up-Right, 2: Down-Right, 3: Down, 4: Down-Left, 5: Up-Left, you can send an array of directions to move in multiple directions"
          ),
      }),
      async handler(call, ctx, agent) {
        try {
          const moveCall: Call = {
            contractAddress: troop_movement_systems!,
            entrypoint: "explorer_move",
            calldata: [explorer_id, call.data.direction, 0],
          };

          const { transaction_hash } = await account.execute(moveCall);

          await account.waitForTransaction(transaction_hash);

          // Return the goal for task decomposition
          return { result: "success" };
        } catch (error) {
          console.error("Error moving explorer:", error);
          return {
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    }),

    action({
      name: "attackOtherExplorers",
      description: "Attack other explorers",
      schema: z.object({
        aggressor_id: z.number().describe("This is your explorer id"),
        defender_id: z
          .number()
          .describe("ID of the explorer you want to attack"),
        defender_direction: z
          .number()
          .describe(
            "Direction to the defender: 0: Up, 1: Up-Right, 2: Down-Right, 3: Down, 4: Down-Left, 5: Up-Left (you have to be adjacent to the defender to attack them)"
          ),
      }),
      async handler(call, ctx, agent) {
        try {
          const moveCall: Call = {
            contractAddress: troop_battle_systems!,
            entrypoint: "attack_explorer_vs_explorer",
            calldata: [
              call.data.aggressor_id,
              call.data.defender_id,
              call.data.defender_direction,
            ],
          };

          const { transaction_hash } = await account.execute(moveCall);

          await account.waitForTransaction(transaction_hash);

          return { result: "success" };
        } catch (error) {
          console.error("Error attacking explorer:", error);
          return {
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    }),
    action({
      name: "attackStructure",
      description:
        "Attack a structure. You have to be adjacent to the structure to attack it.",
      schema: z.object({
        explorer_id: z
          .number()
          .describe("ID of the explorer initiating the attack"),
        structure_id: z.number().describe("ID of the structure being attacked"),
        structure_direction: z
          .number()
          .describe(
            "Direction to the structure: 0: Up, 1: Up-Right, 2: Down-Right, 3: Down, 4: Down-Left, 5: Up-Left"
          ),
      }),
      async handler(call, ctx, agent) {
        try {
          const moveCall: Call = {
            contractAddress: troop_battle_systems!,
            entrypoint: "attack_explorer_vs_explorer",
            calldata: [
              call.data.explorer_id,
              call.data.structure_id,
              call.data.structure_direction,
            ],
          };

          const { transaction_hash } = await account.execute(moveCall);

          await account.waitForTransaction(transaction_hash);

          return { result: "success" };
        } catch (error) {
          console.error("Error attacking explorer:", error);
          return {
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    }),
  ],
});
