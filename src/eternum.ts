import { z } from "zod";
import {
  action,
  extension,
  fetchGraphQL,
  input,
  render,
} from "@daydreamsai/core";

import { context } from "@daydreamsai/core";

import type { Call } from "starknet";
import {
  troop_battle_systems,
  troop_movement_systems,
  troop_raid_systems,
} from "./extract";
import { createNewAccount } from "./account";
import {
  EXPLORER_TROOPS_QUERY,
  TROOPS_IN_RANGE_QUERY,
  TILES_QUERY,
  type GraphQLResponse,
} from "./queries";

// Simple logger for container environment
const logger = {
  debug: (message: string, data?: any) => {
    if (process.env.LOG_LEVEL === "debug") {
      console.log(
        JSON.stringify({
          level: "debug",
          message,
          data,
          timestamp: new Date().toISOString(),
        })
      );
    }
  },
  info: (message: string, data?: any) => {
    console.log(
      JSON.stringify({
        level: "info",
        message,
        data,
        timestamp: new Date().toISOString(),
      })
    );
  },
  warn: (message: string, data?: any) => {
    console.warn(
      JSON.stringify({
        level: "warn",
        message,
        data,
        timestamp: new Date().toISOString(),
      })
    );
  },
  error: (message: string, data?: any) => {
    console.error(
      JSON.stringify({
        level: "error",
        message,
        data,
        timestamp: new Date().toISOString(),
      })
    );
  },
};

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

const torii_url = "https://api.cartridge.gg/x/eternum-sepolia/torii/graphql";

const explorer_id = parseInt(process.env.EVENT_DATA_1 || "228");

logger.info("Initializing eternum extension", { explorer_id });

// Helper function to generate a simplified ASCII map view
function generateASCIIMap(
  tiles: Array<{
    biome: number;
    col: number;
    row: number;
    occupier_id?: number;
  }>,
  currentX: number,
  currentY: number,
  radius: number = 5
): string {
  if (!tiles || tiles.length === 0) return "No map data available";

  // Create a coordinate map for quick lookup
  const tileMap: Record<
    string,
    {
      biome: number;
      col: number;
      row: number;
      occupier_id?: number;
    }
  > = {};

  tiles.forEach((tile) => {
    const key = `${tile.col},${tile.row}`;
    tileMap[key] = tile;
  });

  // Generate the ASCII map view with proper hex grid offset
  let asciiMap = "";

  // For a hexagon grid, we need to adjust the rendering based on row parity
  for (let r = currentY - radius; r <= currentY + radius; r++) {
    // Add indentation for each even row to simulate hex grid offset
    const indent = r % 2 === 0 ? " " : "";
    let row = indent;

    for (let c = currentX - radius; c <= currentX + radius; c++) {
      const key = `${c},${r}`;
      const tile = tileMap[key];

      if (c === currentX && r === currentY) {
        // Current position
        row += "O ";
      } else if (tile) {
        if (tile.occupier_id) {
          // Occupied tile
          row += "X ";
        } else {
          // Regular explored tile - show first letter of biome or number
          const biomeChar =
            BiomeType[tile.biome]?.[0] || tile.biome.toString()[0];
          row += biomeChar + " ";
        }
      } else {
        // Unexplored or out of view
        row += "· ";
      }
    }

    asciiMap += row + "\n";
  }

  // Add a legend
  asciiMap += "\nLegend:\n";
  asciiMap += "O = Your position\n";
  asciiMap += "X = Occupied tiles\n";
  asciiMap += "· = Unexplored/Unknown\n";
  asciiMap += "Letters = Biome types (G=Grassland, O=Ocean, etc.)\n";

  // Add direction compass
  asciiMap += "\nDirections:\n";
  asciiMap += "    1(NE)  2(NW)\n";
  asciiMap += "0(E)   O   3(W)\n";
  asciiMap += "    5(SE)  4(SW)\n";

  console.log(asciiMap);

  return asciiMap;
}

const template = `
    You are explorer  ${explorer_id}.

    <goal>
    1. Your goal is to gain resources.
    2. You gain resources from attacking other explorers and structures.
    2. You should attack other structures to gain resources.
    3. You should attack other explorers to gain resources. You must be adjacent to the explorer to attack them, so move around the map to get close.
    </goal>

    # consider
    - You are currently at coordinates x: {x}, y: {y}.
    - You should always check where you are on the map before moving, otherwise you will get an error
    - If you hit an unexplored hex, you cannot move there. Just try a different direction.

    # Map
    You are on a hexagon map, so consider the shape of the map when making decisions.
    {mapInfo}

    # Combat Opportunities
    {adjacentEntities}
    
    # Strategic Movement
    {pathfindingInfo}

    # Simplified Map View
    {asciiMap}

    # Movement
    - You can move in the following directions. If you move in a direction, you will move to the next hex in that direction:
    - You can submit an array of directions to move in multiple directions in sequence
    - For example, [0, 1] means move East, then NorthEast
    - This allows you to move multiple hexes in one action
    - The directions will be executed in order from left to right in the array
    - Make sure all tiles in your path are explored before attempting multi-direction movement

    0: East
    1: NorthEast
    2: NorthWest
    3: West
    4: SouthWest
    5: SouthEast

    # Attack
    - You can attack other explorers or structures.
    - You must be adjacent to the explorer or structure to attack them.
    - You can submit an array of directions to attack in directions
    - You can only attack explorers or structures that are adjacent to you.
    - You cannot move through occupied tiles.

    `;

const eternumContext = context({
  type: "eternum",
  key: ({ channelId }) => channelId,
  maxWorkingMemorySize: 5,
  schema: z.object({ channelId: z.string() }),

  async setup(args, {}, { context }) {
    return { channelId: args.channelId };
  },

  create(state) {
    return {
      x: 0,
      y: 0,
      troops: {},
      surrounding: {},
      mapState: {
        tiles: [] as Array<{
          biome: number;
          col: number;
          row: number;
          occupier_id?: number;
        }>,
        exploredTiles: {} as Record<
          string,
          {
            biome: number;
            col: number;
            row: number;
            occupier_id?: number;
          }
        >,
        occupiedTiles: {} as Record<string, number>,
        adjacentEntities: [] as Array<{
          direction: number;
          col: number;
          row: number;
          occupier_id: number;
          distance: number;
        }>,
        nearestEntities: [] as Array<{
          col: number;
          row: number;
          occupier_id: number;
          distance: number;
          path?: Array<{
            direction: number;
            col: number;
            row: number;
          }>;
        }>,
        recommendedPath: undefined as Array<number> | undefined,
        lastUpdated: 0,
      },
    };
  },

  render({ memory }) {
    // Generate a simple text representation of the map
    let mapInfo = "";
    let asciiMap =
      "No map data available yet. Use getMapInfo action to scan surroundings.";
    let adjacentEntities =
      "No entities detected nearby. Use getMapInfo to scan for enemies.";
    let pathfindingInfo = "No pathfinding data available yet.";

    if (
      memory.mapState &&
      memory.mapState.tiles &&
      memory.mapState.tiles.length > 0
    ) {
      mapInfo = `
# Map Information
- You have explored ${
        Object.keys(memory.mapState.exploredTiles).length
      } tiles around you.
- There are ${
        Object.keys(memory.mapState.occupiedTiles).length
      } occupied tiles in your vicinity.
- Biomes in your surroundings: ${Array.from(
        new Set(
          memory.mapState.tiles.map(
            (t: { biome: number }) => BiomeType[t.biome]
          )
        )
      ).join(", ")}
      `;

      // Generate ASCII map
      asciiMap = generateASCIIMap(memory.mapState.tiles, memory.x, memory.y);

      // Generate info about adjacent entities for combat
      if (
        memory.mapState.adjacentEntities &&
        memory.mapState.adjacentEntities.length > 0
      ) {
        adjacentEntities = `
You have ${
          memory.mapState.adjacentEntities.length
        } entities adjacent to you that can be attacked:
${memory.mapState.adjacentEntities
  .map(
    (
      entity: {
        occupier_id: number;
        col: number;
        row: number;
        direction: number;
      },
      index: number
    ) =>
      `${index + 1}. Entity ID: ${entity.occupier_id} at (${entity.col}, ${
        entity.row
      }) - Direction: ${entity.direction}`
  )
  .join("\n")}

You can attack these entities with the attackOtherExplorers or attackStructure actions.
        `;
      } else {
        adjacentEntities =
          "No entities are adjacent to you for immediate attack.";
      }

      // Generate pathfinding info for strategic movement
      if (
        memory.mapState.nearestEntities &&
        memory.mapState.nearestEntities.length > 0
      ) {
        pathfindingInfo = `
Nearest entities to target:
${memory.mapState.nearestEntities
  .map(
    (
      entity: {
        occupier_id: number;
        col: number;
        row: number;
        distance: number;
      },
      index: number
    ) =>
      `${index + 1}. Entity ID: ${entity.occupier_id} at (${entity.col}, ${
        entity.row
      }) - Distance: ${entity.distance}`
  )
  .join("\n")}

${
  memory.mapState.recommendedPath && memory.mapState.recommendedPath.length > 0
    ? `Recommended movement path to nearest entity: ${JSON.stringify(
        memory.mapState.recommendedPath
      )}`
    : "No clear path available to nearby entities."
}

Use the moveExplorer action with the recommended directions to approach the nearest entity.
        `;
      }
    }

    return render(template, {
      x: memory.x,
      y: memory.y,
      troops: memory.troops,
      surrounding: memory.surrounding,
      mapInfo: mapInfo,
      asciiMap: asciiMap,
      adjacentEntities: adjacentEntities,
      pathfindingInfo: pathfindingInfo,
    });
  },

  description({}) {
    return `Eternum Context`;
  },
});

// Initialize account
const account = await createNewAccount();

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
        const intervalMs = 1 * 60 * 1000;
        logger.info("Setting up recurring task", {
          interval_seconds: intervalMs / 1000,
        });

        // Create interval to trigger the agent every 20 seconds
        const intervalId = setInterval(async () => {
          logger.debug("Triggering recurring task");

          // First update the map info
          try {
            // Get current position
            const positionResponse = await fetchGraphQL<GraphQLResponse>(
              torii_url,
              EXPLORER_TROOPS_QUERY,
              {
                explorer_id: explorer_id,
              }
            );

            if (!(positionResponse instanceof Error)) {
              const node =
                positionResponse.s1EternumExplorerTroopsModels?.edges?.[0]
                  ?.node;
              if (!node || !node.coord) {
                console.error("Invalid response structure:", positionResponse);
                return;
              }
              const { x, y } = node.coord;

              // Fetch tiles around the current position
              const tileResponse = await fetchGraphQL<GraphQLResponse>(
                torii_url,
                TILES_QUERY,
                {
                  colMin: x - 15,
                  colMax: x + 15,
                  rowMin: y - 15,
                  rowMax: y + 15,
                }
              );

              // If we have tile data, process it
              if (
                !(tileResponse instanceof Error) &&
                tileResponse.s1EternumTileModels?.edges
              ) {
                const tiles = tileResponse.s1EternumTileModels.edges.map(
                  (edge) => edge.node
                );

                logger.debug("Map data updated", { tile_count: tiles.length });
              }
            }
          } catch (error) {
            logger.error("Error updating map state in recurring trigger", {
              error: error instanceof Error ? error.message : String(error),
            });
          }

          // Then trigger the agent
          send(
            eternumContext,
            { channelId: "eternum" },
            {
              timestamp: Date.now(),
              message:
                "Complete your mission. First check your surroundings with getMapInfo to update your map state.",
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

        const node = response.s1EternumExplorerTroopsModels?.edges?.[0]?.node;
        if (!node || !node.troops) {
          return { result: "No troops found" };
        }

        // Fetch current tick
        const currentTick = await fetchCurrentTick();

        // Process the single troop
        const troop = node.troops;
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

        const node =
          positionResponse.s1EternumExplorerTroopsModels?.edges?.[0]?.node;
        if (!node || !node.coord) {
          return { result: null };
        }
        const { x, y } = node.coord;

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

        // Fetch current tick
        const currentTick = await fetchCurrentTick();

        // Process each troop's stamina
        const processedTroops =
          response.s1EternumExplorerTroopsModels.edges.map((edge) => {
            const troop = edge.node.troops;
            const calculatedStamina = calculateStamina(
              troop.stamina,
              troop.category,
              currentTick
            );

            return {
              ...edge.node,
              troops: {
                ...troop,
                calculatedStamina: {
                  ...calculatedStamina,
                  percentFull: Math.round(
                    (calculatedStamina.amount / calculatedStamina.maxStamina) *
                      100
                  ),
                  canTravel:
                    calculatedStamina.amount >=
                    calculatedStamina.staminaCostForTravel,
                  canExplore:
                    calculatedStamina.amount >=
                    calculatedStamina.staminaCostForExplore,
                },
              },
            };
          });

        const memory = ctx.memory;
        memory.surrounding = processedTroops;

        return {
          result: processedTroops,
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

        const node = response.s1EternumExplorerTroopsModels?.edges?.[0]?.node;
        if (!node || !node.coord) {
          return { result: null };
        }
        const { x, y } = node.coord;

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

        const memory = ctx.memory;
        memory.x = x;
        memory.y = y;
        memory.processedTroops = processedTroop;

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
      description:
        "Move the explorer to a new position. You can move multiple hexes in one action by providing an array of directions. Each direction will be executed in sequence, allowing you to move multiple hexes in one turn. For example, [0, 1] means move East, then NorthEast. Make sure all tiles in your path are explored before attempting multi-direction movement.",
      schema: z.object({
        direction: z
          .number()
          .array()
          .describe(
            `
          Array of directions to move the explorer. Each direction will be executed in sequence.
          You can move multiple hexes in one action by providing multiple directions.
          For example, [0, 1] means move East, then NorthEast.
          
          Directions:
          0: East
          1: NorthEast
          2: NorthWest
          3: West
          4: SouthWest
          5: SouthEast
          
          Important:
          - Each direction will be executed in order from left to right
          - Make sure all tiles in your path are explored
          - You cannot move through occupied tiles
          - You cannot move through unexplored tiles
          `
          ),
      }),
      async handler(call, ctx, agent) {
        try {
          // Get the current position and map state from memory
          const memory = ctx.agentMemory;
          const currentX = memory.x;
          const currentY = memory.y;

          // Validate that the tiles we're trying to move to have been explored
          if (call.direction && call.direction.length > 0) {
            let posX = currentX;
            let posY = currentY;

            for (const direction of call.direction) {
              // Get the next position based on the direction
              const nextPos = getNeighborCoord(posX, posY, direction);

              // Check if the next position is explored
              const tileKey = `${nextPos.x},${nextPos.y}`;
              if (!memory.mapState.exploredTiles[tileKey]) {
                return {
                  error: `Cannot move to unexplored tile at (${nextPos.x}, ${nextPos.y}) in direction ${direction}. Please use getMapInfo first to scan the area.`,
                };
              }

              // Check if the tile is occupied
              if (memory.mapState.exploredTiles[tileKey].occupier_id) {
                return {
                  error: `Cannot move to occupied tile at (${nextPos.x}, ${nextPos.y}) in direction ${direction}. This tile contains entity ID: ${memory.mapState.exploredTiles[tileKey].occupier_id}.`,
                };
              }

              // Update the position for multi-step moves
              posX = nextPos.x;
              posY = nextPos.y;
            }
          }

          const moveCall: Call = {
            contractAddress: troop_movement_systems!,
            entrypoint: "explorer_move",
            calldata: [explorer_id, call.direction, 0],
          };

          logger.info("Moving explorer", {
            explorer_id,
            directions: call.direction,
            contract: troop_movement_systems,
            account: account.address,
          });

          const { transaction_hash } = await account.execute(moveCall);

          await account.waitForTransaction(transaction_hash);

          // Update the agent memory with the new position (assuming the move was successful)
          // We'll do a proper update in the next getMapInfo call
          if (call.direction && call.direction.length > 0) {
            let posX = currentX;
            let posY = currentY;

            for (const direction of call.direction) {
              const nextPos = getNeighborCoord(posX, posY, direction);
              posX = nextPos.x;
              posY = nextPos.y;
            }

            memory.x = posX;
            memory.y = posY;
          }

          // Return the goal for task decomposition
          return { result: "success" };
        } catch (error) {
          logger.error("Error moving explorer", {
            error: error instanceof Error ? error.message : String(error),
            explorer_id,
            directions: call.direction,
          });

          // Extract more detailed error message if available
          let errorMessage =
            error instanceof Error ? error.message : String(error);

          // Look for the specific error about unexplored tiles
          if (
            typeof errorMessage === "string" &&
            errorMessage.includes("one of the tiles in path is not explored")
          ) {
            return {
              error:
                "Movement failed: One of the tiles in the path is not explored. Use getMapInfo action first to scan the area.",
            };
          }

          return {
            error: errorMessage,
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
        defender_direction: z.number().describe(
          `Direction to the defender(you have to be adjacent to the defender to attack them):           
          0: East
          1: NorthEast
          2: NorthWest
          3: West
          4: SouthWest
          5: SouthEast`
        ),
      }),
      async handler(call, ctx, agent) {
        try {
          // Get the current position and map state from memory
          const memory = ctx.memory;
          const currentX = memory.x;
          const currentY = memory.y;

          // Validate that the direction is valid (0-5)
          if (call.defender_direction < 0 || call.defender_direction > 5) {
            return {
              error: `Invalid direction: ${call.defender_direction}. Direction must be between 0 and 5.`,
            };
          }

          // Check if there's actually an enemy in that direction
          const targetPos = getNeighborCoord(
            currentX,
            currentY,
            call.defender_direction
          );
          const tileKey = `${targetPos.x},${targetPos.y}`;

          // Make sure the tile is explored first
          if (!memory.mapState.exploredTiles[tileKey]) {
            return {
              error: `No explored tile in direction ${call.defender_direction}. Please use getMapInfo first to scan the area.`,
            };
          }

          // Check if there's an entity in that direction with the matching ID
          const adjacentEntities = memory.mapState.adjacentEntities || [];
          const targetEntity = adjacentEntities.find(
            (entity: { direction: number; occupier_id: number }) =>
              entity.direction === call.defender_direction &&
              entity.occupier_id === call.defender_id
          );

          if (!targetEntity) {
            return {
              error: `No entity with ID ${call.defender_id} found in direction ${call.defender_direction}. Please use getMapInfo first to update your surroundings.`,
            };
          }

          const moveCall: Call = {
            contractAddress: troop_battle_systems!,
            entrypoint: "attack_explorer_vs_explorer",
            calldata: [
              call.aggressor_id,
              call.defender_id,
              call.defender_direction,
            ],
          };

          const { transaction_hash } = await account.execute(moveCall);

          await account.waitForTransaction(transaction_hash);

          return { result: "success" };
        } catch (error) {
          logger.error("Error attacking explorer", {
            error: error instanceof Error ? error.message : String(error),
            aggressor_id: call.aggressor_id,
            defender_id: call.defender_id,
            direction: call.defender_direction,
          });

          // Extract more detailed error message if available
          let errorMessage =
            error instanceof Error ? error.message : String(error);
          return {
            error: errorMessage,
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
            "Direction to the structure: 0: East, 1: NorthEast, 2: NorthWest, 3: West, 4: SouthWest, 5: SouthEast"
          ),
      }),
      async handler(call, ctx, agent) {
        try {
          // Get the current position and map state from memory
          const memory = ctx.memory;
          const currentX = memory.x;
          const currentY = memory.y;

          // Validate that the direction is valid (0-5)
          if (call.structure_direction < 0 || call.structure_direction > 5) {
            return {
              error: `Invalid direction: ${call.structure_direction}. Direction must be between 0 and 5.`,
            };
          }

          // Check if there's actually a structure in that direction
          const targetPos = getNeighborCoord(
            currentX,
            currentY,
            call.structure_direction
          );
          const tileKey = `${targetPos.x},${targetPos.y}`;

          // Make sure the tile is explored first
          if (!memory.mapState.exploredTiles[tileKey]) {
            return {
              error: `No explored tile in direction ${call.structure_direction}. Please use getMapInfo first to scan the area.`,
            };
          }

          // Check if there's an entity in that direction with the matching ID
          const adjacentEntities = memory.mapState.adjacentEntities || [];
          const targetEntity = adjacentEntities.find(
            (entity: { direction: number; occupier_id: number }) =>
              entity.direction === call.structure_direction &&
              entity.occupier_id === call.structure_id
          );

          if (!targetEntity) {
            return {
              error: `No structure with ID ${call.structure_id} found in direction ${call.structure_direction}. Please use getMapInfo first to update your surroundings.`,
            };
          }

          const moveCall: Call = {
            contractAddress: troop_raid_systems!,
            entrypoint: "raid_explorer_vs_guard",
            calldata: [
              call.explorer_id,
              call.structure_id,
              call.structure_direction,
              [10, 2000],
            ],
          };

          logger.info("Attacking structure", {
            explorer_id: call.explorer_id,
            structure_id: call.structure_id,
            direction: call.structure_direction,
            contract: troop_raid_systems,
          });

          const { transaction_hash } = await account.execute(moveCall);

          await account.waitForTransaction(transaction_hash);

          return { result: "success" };
        } catch (error) {
          logger.error("Error attacking structure", {
            error: error instanceof Error ? error.message : String(error),
            explorer_id: call.explorer_id,
            structure_id: call.structure_id,
            direction: call.structure_direction,
          });

          // Extract more detailed error message if available
          let errorMessage =
            error instanceof Error ? error.message : String(error);
          return {
            error: errorMessage,
          };
        }
      },
    }),
    action({
      name: "getMapInfo",
      description:
        "Build a map state of the explorer's surroundings to help with navigation",
      schema: z.object({
        radius: z
          .number()
          .optional()
          .describe("Radius around the current position to scan (default: 15)"),
      }),
      async handler(call, ctx, agent) {
        try {
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

          const node =
            positionResponse.s1EternumExplorerTroopsModels?.edges?.[0]?.node;
          if (!node || !node.coord) {
            return {
              error: "Invalid response structure: missing coordinate data",
            };
          }
          const { x, y } = node.coord;

          // Set radius (default 15 if not provided)
          const radius = call.radius || 15;

          // Convert from cartesian (x,y) to axial (col,row) coordinates for the hexagonal grid
          // This is a simple conversion for hexagonal grid
          // Note: You may need to adjust this conversion based on your specific grid implementation
          const col = x;
          const row = y;

          // Fetch tiles around the current position
          const tileResponse = await fetchGraphQL<GraphQLResponse>(
            torii_url,
            TILES_QUERY,
            {
              colMin: col - radius,
              colMax: col + radius,
              rowMin: row - radius,
              rowMax: row + radius,
            }
          );

          if (tileResponse instanceof Error) {
            throw tileResponse;
          }

          // Check if we have tile data
          if (!tileResponse.s1EternumTileModels?.edges) {
            return { result: "No tile data found" };
          }

          // Process tile data
          const tiles = tileResponse.s1EternumTileModels.edges.map(
            (edge) => edge.node
          );

          // Create lookup maps for explored and occupied tiles
          const exploredTiles: Record<
            string,
            {
              biome: number;
              col: number;
              row: number;
              occupier_id?: number;
            }
          > = {};

          const occupiedTiles: Record<string, number> = {};

          tiles.forEach((tile) => {
            const tileKey = `${tile.col},${tile.row}`;
            exploredTiles[tileKey] = tile;

            if (tile.occupier_id) {
              occupiedTiles[tileKey] = tile.occupier_id;
            }
          });

          // Find adjacent entities (for immediate attack opportunities)
          const adjacentEntities = findAdjacentEntities(exploredTiles, x, y);

          // Find nearest entities (for pathfinding)
          const nearestEntities = findNearestEntity(exploredTiles, x, y);

          // Update memory
          const memory = ctx.agentMemory;
          memory.mapState = {
            tiles,
            exploredTiles,
            occupiedTiles,
            adjacentEntities,
            nearestEntities: nearestEntities.nearestEntities,
            recommendedPath: nearestEntities.recommendedPath,
            lastUpdated: Date.now(),
          };

          // Also update current position
          memory.x = x;
          memory.y = y;

          // Return result
          return {
            result: {
              currentPosition: { x, y, col, row },
              exploredTileCount: tiles.length,
              occupiedTileCount: Object.keys(occupiedTiles).length,
              adjacentEntities,
              nearestEntities: nearestEntities.nearestEntities,
              recommendedPath: nearestEntities.recommendedPath,
              asciiMap: generateASCIIMap(tiles, x, y, 5),
            },
          };
        } catch (error) {
          logger.error("Error building map state", {
            error: error instanceof Error ? error.message : String(error),
            explorer_id,
            radius: call.radius || 15,
          });

          return {
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    }),
  ],
});

// Helper function to get the correct neighbor coordinates based on row parity (even/odd)
function getNeighborCoord(
  x: number,
  y: number,
  direction: number
): { x: number; y: number } {
  // Direction enum: 0: East, 1: NorthEast, 2: NorthWest, 3: West, 4: SouthWest, 5: SouthEast
  // Based on the contract code, which uses even-r offset coordinate system:
  // - For even rows (y % 2 == 0), columns are shifted differently than odd rows

  if (y % 2 === 0) {
    // Even row
    switch (direction) {
      case 0:
        return { x: x + 1, y: y }; // East
      case 1:
        return { x: x + 1, y: y + 1 }; // NorthEast
      case 2:
        return { x: x, y: y + 1 }; // NorthWest
      case 3:
        return { x: x - 1, y: y }; // West
      case 4:
        return { x: x, y: y - 1 }; // SouthWest
      case 5:
        return { x: x + 1, y: y - 1 }; // SouthEast
      default:
        return { x, y };
    }
  } else {
    // Odd row
    switch (direction) {
      case 0:
        return { x: x + 1, y: y }; // East
      case 1:
        return { x: x, y: y + 1 }; // NorthEast
      case 2:
        return { x: x - 1, y: y + 1 }; // NorthWest
      case 3:
        return { x: x - 1, y: y }; // West
      case 4:
        return { x: x - 1, y: y - 1 }; // SouthWest
      case 5:
        return { x: x, y: y - 1 }; // SouthEast
      default:
        return { x, y };
    }
  }
}

// Helper function to find adjacent entities (enemies or structures)
function findAdjacentEntities(
  exploredTiles: Record<
    string,
    {
      biome: number;
      col: number;
      row: number;
      occupier_id?: number;
    }
  >,
  currentX: number,
  currentY: number
): Array<{
  direction: number;
  col: number;
  row: number;
  occupier_id: number;
  distance: number;
}> {
  // Direction enum: 0: East, 1: NorthEast, 2: NorthWest, 3: West, 4: SouthWest, 5: SouthEast
  const adjacentEntities: Array<{
    direction: number;
    col: number;
    row: number;
    occupier_id: number;
    distance: number;
  }> = [];

  // Check each direction
  for (let direction = 0; direction < 6; direction++) {
    const neighbor = getNeighborCoord(currentX, currentY, direction);
    const key = `${neighbor.x},${neighbor.y}`;

    if (exploredTiles[key] && exploredTiles[key].occupier_id) {
      adjacentEntities.push({
        direction,
        col: neighbor.x,
        row: neighbor.y,
        occupier_id: exploredTiles[key].occupier_id!,
        distance: 1, // Adjacent = distance 1
      });
    }
  }

  return adjacentEntities;
}

// Helper function to find the nearest entity (enemy or structure)
function findNearestEntity(
  exploredTiles: Record<
    string,
    {
      biome: number;
      col: number;
      row: number;
      occupier_id?: number;
    }
  >,
  currentX: number,
  currentY: number,
  maxDistance: number = 10
): {
  nearestEntities: Array<{
    col: number;
    row: number;
    occupier_id: number;
    distance: number;
    path?: Array<{
      direction: number;
      col: number;
      row: number;
    }>;
  }>;
  recommendedPath?: Array<number>;
} {
  const occupiedTiles = Object.entries(exploredTiles)
    .filter(([_, tile]) => tile.occupier_id !== undefined)
    .map(([key, tile]) => ({
      col: tile.col,
      row: tile.row,
      occupier_id: tile.occupier_id!,
      distance: calculateHexDistance(currentX, currentY, tile.col, tile.row),
    }))
    .filter((entity) => entity.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);

  type EntityWithPath = {
    col: number;
    row: number;
    occupier_id: number;
    distance: number;
    path?: Array<{
      direction: number;
      col: number;
      row: number;
    }>;
  };

  // Find paths to the nearest entities (up to 3)
  const nearestEntities = occupiedTiles.slice(0, 3).map((entity) => {
    // Only calculate path if it's not adjacent
    if (entity.distance > 1) {
      const path = findPathToTarget(
        exploredTiles,
        currentX,
        currentY,
        entity.col,
        entity.row
      );
      return {
        ...entity,
        path: path,
      } as EntityWithPath;
    }
    return entity as EntityWithPath;
  });

  // Get recommended path (directions) to the nearest entity
  let recommendedPath: Array<number> | undefined;
  if (
    nearestEntities.length > 0 &&
    nearestEntities[0].path &&
    nearestEntities[0].path.length > 0
  ) {
    recommendedPath = nearestEntities[0].path.map(
      (step: { direction: number }) => step.direction
    );
  }

  return {
    nearestEntities,
    recommendedPath,
  };
}

// Calculate hex grid distance (using axial coordinates)
function calculateHexDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  // In axial coordinates, the distance is:
  // distance = (abs(q1 - q2) + abs(r1 - r2) + abs(q1 + r1 - q2 - r2)) / 2
  // where (q,r) are axial coordinates
  // Simplified for our case where (col,row) = (x,y)
  return Math.max(
    Math.abs(x1 - x2),
    Math.abs(y1 - y2),
    Math.abs(x1 + y1 - x2 - y2)
  );
}

// Find path to target using a simple A* algorithm for hex grid
function findPathToTarget(
  exploredTiles: Record<
    string,
    {
      biome: number;
      col: number;
      row: number;
      occupier_id?: number;
    }
  >,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  maxLength: number = 10
): Array<{
  direction: number;
  col: number;
  row: number;
}> {
  // Simple greedy approach - move in the direction that brings us closer
  const path: Array<{
    direction: number;
    col: number;
    row: number;
  }> = [];

  let currentX = startX;
  let currentY = startY;

  // Keep going until we're adjacent to the target or reach max path length
  while (
    calculateHexDistance(currentX, currentY, targetX, targetY) > 1 &&
    path.length < maxLength
  ) {
    // Find the best direction that brings us closer to the target
    let bestDirection = -1;
    let bestDistance = Infinity;

    for (let direction = 0; direction < 6; direction++) {
      const neighbor = getNeighborCoord(currentX, currentY, direction);
      const key = `${neighbor.x},${neighbor.y}`;

      // Skip if tile is not explored or is occupied
      if (!exploredTiles[key] || exploredTiles[key].occupier_id) {
        continue;
      }

      const distance = calculateHexDistance(
        neighbor.x,
        neighbor.y,
        targetX,
        targetY
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        bestDirection = direction;
      }
    }

    // If we can't find a valid direction, break
    if (bestDirection === -1) {
      break;
    }

    // Move in the best direction
    const nextPos = getNeighborCoord(currentX, currentY, bestDirection);
    currentX = nextPos.x;
    currentY = nextPos.y;

    // Add to path
    path.push({
      direction: bestDirection,
      col: currentX,
      row: currentY,
    });
  }

  return path;
}
