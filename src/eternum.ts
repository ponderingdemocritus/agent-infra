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
  RESOURCES_QUERY,
  type GraphQLResponse,
} from "./queries";
import { BiomeType, ResourcesIds, TileOccupier } from "./types";
import {
  generateASCIIMap,
  calculateStamina,
  fetchCurrentTick,
  getNeighborCoord,
  findAdjacentEntities,
  findNearestEntity,
  processResourceData,
  RESOURCES_WEIGHTS_NANOGRAM,
} from "./utils";

const INTERVAL_MINUTES = 0.2;
const MAP_RADIUS = 25;

const torii_url =
  "https://api.cartridge.gg/x/eternum-sepolia-interim/torii/graphql";

const explorer_id = parseInt(process.env.EVENT_DATA_1 || "195");

console.info("Initializing eternum extension", JSON.stringify({ explorer_id }));

// Initialize account
const account = await createNewAccount();

const template = `
    You are an expert gamer and a seasoned commander in the game world of Eternum. You excel at raiding structures and defeating rival explorers. You should take an action if you can, never just be idle.

    ═══════════════════════════════════════════════════════
    PRIMARY OBJECTIVE
    ═══════════════════════════════════════════════════════
    • Attack the closest Realm which is indicated by the 1 on the map.
    • Accumulate resources by raiding structures and defeating rival explorers.
    • Stay alive.
    • Stay focused on a target until it is dead or you run out of stamina.

    SECONDARY OBJECTIVES
    • Continuously explore safe tiles to expand your tactical options.
    • Prioritise high-value, low-risk targets (isolated structures or weakened explorers).

    ═══════════════════════════════════════════════════════
    CURRENT STATUS
    ────────────────────────────────────────────────────────
    • Position        : (x = {{x}}, y = {{y}})
    • Troop Summary   : {{troops}}
    • Nearby Entities : {{surrounding}}

    MAP INTEL
    ────────────────────────────────────────────────────────
    {{mapInfo}}

    ADJACENT ENTITIES ‑ Ready for Immediate Attack
    ────────────────────────────────────────────────────────
    {{adjacentEntities}}

    PATHFINDING RECOMMENDATIONS
    ────────────────────────────────────────────────────────
    {{pathfindingInfo}}

    ASCII MINI-MAP ( O = you )
    ────────────────────────────────────────────────────────
    {{asciiMap}}

    ═══════════════════════════════════════════════════════
    ACTION PROTOCOL
    ═══════════════════════════════════════════════════════
    1. SENSE  – Review the map and adjacent entities.
    2. PLAN   – Decide between ATTACK, RAID (eternum.raidStructure) or MOVE (eternum.moveExplorer) based on stamina and objectives.
                • If an adjacent target is weak ⇒ ATTACK.
                • If an adjacent target is a structure ⇒ RAID.
                • Else move toward the closest lucrative target using {{recommendedPath}}.
    3. ACT    – Issue exactly ONE action.

    ── MOVEMENT ───────────────────────────────────────────
    • Use "eternum.moveExplorer" with an ARRAY of directions to chain moves.
      Example:  [0, 1]  ⇒ East, then North-East. You should always move in the direction of the nearest entity, and move more than 1 tile at once. You can only move in the {{availableDirections}}
    • Directions (axial):
        0 → East       1 → Southeast
        2 → Southwest  3 → West
        4 → Northwest  5 → Northeast
    • Restrictions:
        – Cannot move through unexplored or occupied tiles. Which are represented by the [.]
        – Ensure sufficient stamina for the full path.

    ── COMBAT ─────────────────────────────────────────────
    • Use "eternum.attackExplorer" or "eternum.attackStructure" or "eternum.raidStructure".
    • Target must occupy one of the six adjacent hexes (see list above).
    • Supply the direction that matches the target's position.

    `;

const eternumContext = context({
  type: "eternum",

  key: ({ channelId }) => channelId,
  maxWorkingMemorySize: 15,
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
          occupier_type: number;
          distance: number;
          path?: Array<{
            direction: number;
            col: number;
            row: number;
          }>;
        }>,
        availableDirections: [] as Array<number>,
        recommendedPath: undefined as Array<number> | undefined,
        lastUpdated: 0,
      },
    };
  },

  render({ memory }) {
    // Generate a simple text representation of the map
    let mapInfo = "";
    let asciiMap = "No map data available yet.";
    let adjacentEntities = "No entities detected nearby.";
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
      asciiMap = generateASCIIMap(
        memory.mapState.tiles,
        memory.x,
        memory.y,
        MAP_RADIUS
      );

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

    console.log(
      render(template, {
        x: memory.x,
        y: memory.y,
        troops: memory.troops,
        surrounding: memory.surrounding,
        mapInfo: mapInfo,
        asciiMap: asciiMap,
        adjacentEntities: adjacentEntities,
        pathfindingInfo: pathfindingInfo,
        availableDirections: memory.mapState.availableDirections,
        recommendedPath: memory.mapState.recommendedPath,
      })
    );

    return render(template, {
      x: memory.x,
      y: memory.y,
      troops: memory.troops,
      surrounding: memory.surrounding,
      mapInfo: mapInfo,
      asciiMap: asciiMap,
      adjacentEntities: adjacentEntities,
      pathfindingInfo: pathfindingInfo,
      availableDirections: memory.mapState.availableDirections,
      recommendedPath: memory.mapState.recommendedPath,
    });
  },

  async loader(state, agent) {
    try {
      agent.logger.debug(
        "Loader: Fetching current state for explorer",
        explorer_id.toString()
      );

      // 1. Get current position and troops
      const troopsResponse = await fetchGraphQL<GraphQLResponse>(
        torii_url,
        EXPLORER_TROOPS_QUERY,
        { explorer_id: explorer_id }
      );

      if (troopsResponse instanceof Error) {
        throw new Error(`Failed to fetch troops: ${troopsResponse.message}`);
      }

      const troopNode =
        troopsResponse.s1EternumExplorerTroopsModels?.edges?.[0]?.node;
      if (!troopNode || !troopNode.coord || !troopNode.troops) {
        agent.logger.warn(
          "Loader: Invalid troop response structure",
          JSON.stringify(troopsResponse)
        );

        state.memory.x = state.memory.x || 0; // Access via state.memory
        state.memory.y = state.memory.y || 0; // Access via state.memory
      } else {
        const { x, y } = troopNode.coord;
        state.memory.x = x; // Access via state.memory
        state.memory.y = y; // Access via state.memory

        // Fetch current tick for stamina calculation
        const currentTick = await fetchCurrentTick();

        // Process troop stamina
        const troop = troopNode.troops;
        const calculatedStamina = calculateStamina(
          troop.stamina,
          troop.category,
          currentTick
        );
        state.memory.troops = {
          // Access via state.memory
          ...troop,
          calculatedStamina: {
            ...calculatedStamina,
            percentFull: Math.round(
              (calculatedStamina.amount / calculatedStamina.maxStamina) * 100
            ),
            canTravel:
              calculatedStamina.amount >=
              calculatedStamina.staminaCostForTravel,
            canExplore: false, // can't explore
          },
        };
        agent.logger.debug(
          "Loader: Updated position and troops",
          JSON.stringify({
            x,
            y,
            troops: state.memory.troops,
          })
        ); // Access via state.memory
      }

      // 2. Fetch map tiles around the current position (use default radius 15)
      const radius = MAP_RADIUS;
      const col = state.memory.x; // Access via state.memory
      const row = state.memory.y; // Access via state.memory

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
        throw new Error(`Failed to fetch tiles: ${tileResponse.message}`);
      }

      let tiles: Array<{
        biome: number;
        col: number;
        row: number;
        occupier_id?: number;
      }> = [];
      const exploredTiles: Record<
        string,
        {
          biome: number;
          col: number;
          row: number;
          occupier_id?: number;
          occupier_type?: number;
        }
      > = {};
      const occupiedTiles: Record<string, number> = {};
      let adjacentEntities: Array<{
        direction: number;
        col: number;
        row: number;
        occupier_id: number;
        distance: number;
      }> = [];
      let calculatedNearestEntities: Array<{
        col: number;
        row: number;
        occupier_id: number;
        occupier_type: number;
        distance: number;
        path?: Array<{ direction: number; col: number; row: number }>;
      }> = [];
      let calculatedRecommendedPath: Array<number> | undefined = undefined;

      if (tileResponse.s1EternumTileModels?.edges) {
        tiles = tileResponse.s1EternumTileModels.edges.map((edge) => edge.node);

        tiles.forEach((tile) => {
          const tileKey = `${tile.col},${tile.row}`;
          exploredTiles[tileKey] = tile;
          if (tile.occupier_id) {
            occupiedTiles[tileKey] = tile.occupier_id;
          }
        });

        // Find adjacent and nearest entities
        adjacentEntities = findAdjacentEntities(
          exploredTiles,
          state.memory.x,
          state.memory.y
        ); // Access via state.memory
        const { nearestEntities: foundNearest, recommendedPath: foundPath } =
          findNearestEntity(exploredTiles, state.memory.x, state.memory.y); // Access via state.memory
        calculatedNearestEntities = foundNearest; // Assign separately
        calculatedRecommendedPath = foundPath; // Assign separately

        agent.logger.debug(
          "Loader: Updated map state",
          JSON.stringify({
            tile_count: tiles.length,
            adjacent: adjacentEntities.length,
            nearest: calculatedNearestEntities.length,
          })
        );
      } else {
        agent.logger.warn(
          "Loader: No tile data found in response",
          JSON.stringify({ tileResponse })
        );
      }

      const availableDirections: number[] = [];
      for (let direction = 0; direction < 6; direction++) {
        const neighbor = getNeighborCoord(
          state.memory.x,
          state.memory.y,
          direction
        );
        const neighborKey = `${neighbor.x},${neighbor.y}`;

        // A direction is available if the tile exists and is not occupied
        if (
          exploredTiles[neighborKey] &&
          (!exploredTiles[neighborKey].occupier_type ||
            exploredTiles[neighborKey].occupier_type === TileOccupier.None)
        ) {
          availableDirections.push(direction);
        }
      }
      // Update map state in memory
      state.memory.mapState = {
        // Access via state.memory
        tiles,
        exploredTiles,
        occupiedTiles,
        adjacentEntities,
        nearestEntities: [], // Assign the calculated value
        recommendedPath: [], // Assign the calculated value
        availableDirections: availableDirections, // Assign the calculated value
        lastUpdated: Date.now(),
      };

      // 3. Fetch troops in range (use default range 20)
      const range = MAP_RADIUS;
      const surroundingResponse = await fetchGraphQL<GraphQLResponse>(
        torii_url,
        TROOPS_IN_RANGE_QUERY,
        {
          xMin: state.memory.x - range, // Access via state.memory
          xMax: state.memory.x + range, // Access via state.memory
          yMin: state.memory.y - range, // Access via state.memory
          yMax: state.memory.y + range, // Access via state.memory
        }
      );

      if (surroundingResponse instanceof Error) {
        throw new Error(
          `Failed to fetch surrounding troops: ${surroundingResponse.message}`
        );
      }

      let processedSurroundingTroops: any[] = [];
      if (surroundingResponse.s1EternumExplorerTroopsModels?.edges) {
        const currentTick = await fetchCurrentTick(); // Fetch tick again if needed or pass from above
        processedSurroundingTroops =
          surroundingResponse.s1EternumExplorerTroopsModels.edges
            .filter((edge) => edge?.node?.explorer_id !== explorer_id) // Filter out self
            .map((edge) => {
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
                      (calculatedStamina.amount /
                        calculatedStamina.maxStamina) *
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
        agent.logger.debug(
          "Loader: Updated surrounding troops",
          JSON.stringify({
            count: processedSurroundingTroops.length,
          })
        );
      } else {
        agent.logger.warn(
          "Loader: No surrounding troops found in response",
          JSON.stringify({
            surroundingResponse,
          })
        );
      }

      state.memory.surrounding = processedSurroundingTroops; // Access via state.memory
    } catch (error) {
      console.error(
        "Error in loader function",
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          explorer_id,
        })
      );
    }
  },

  description({}) {
    return `I want you to act as a Player in the Eternum game.
    `;
  },
}).setActions([
  // action({
  //   name: "eternum.getStaminaInfo",
  //   description:
  //     "Get the current stamina information for the explorer's troops",
  //   schema: z.object({}),
  //   async handler(call, ctx, agent) {
  //     // Get current troops information
  //     const response = await fetchGraphQL<GraphQLResponse>(
  //       torii_url,
  //       EXPLORER_TROOPS_QUERY,
  //       {
  //         explorer_id: explorer_id,
  //       }
  //     );

  //     if (response instanceof Error) {
  //       throw response;
  //     }

  //     const node = response.s1EternumExplorerTroopsModels?.edges?.[0]?.node;
  //     if (!node || !node.troops) {
  //       return { result: "No troops found" };
  //     }

  //     // Fetch current tick
  //     const currentTick = await fetchCurrentTick();

  //     // Process the single troop
  //     const troop = node.troops;
  //     const calculatedStamina = calculateStamina(
  //       troop.stamina,
  //       troop.category,
  //       currentTick
  //     );

  //     const staminaInfo = {
  //       category: troop.category,
  //       tier: troop.tier,
  //       count: troop.count,
  //       stamina: calculatedStamina,
  //       percentFull: Math.round(
  //         (calculatedStamina.amount / calculatedStamina.maxStamina) * 100
  //       ),
  //       canTravel:
  //         calculatedStamina.amount >= calculatedStamina.staminaCostForTravel,
  //       canExplore:
  //         calculatedStamina.amount >= calculatedStamina.staminaCostForExplore,
  //     };

  //     return {
  //       result: staminaInfo,
  //     };
  //   },
  // }),
  // action({
  //   name: "eternum.getTroopsInRange",
  //   description: "Get all troops within 20 units of the current position",
  //   schema: z.object({}),
  //   async handler(call, ctx, agent) {
  //     // First get current position
  //     const positionResponse = await fetchGraphQL<GraphQLResponse>(
  //       torii_url,
  //       EXPLORER_TROOPS_QUERY,
  //       {
  //         explorer_id: explorer_id,
  //       }
  //     );

  //     if (positionResponse instanceof Error) {
  //       throw positionResponse;
  //     }

  //     const node =
  //       positionResponse.s1EternumExplorerTroopsModels?.edges?.[0]?.node;
  //     if (!node || !node.coord) {
  //       return { result: null };
  //     }
  //     const { x, y } = node.coord;

  //     // Now search for troops in range
  //     const response = await fetchGraphQL<GraphQLResponse>(
  //       torii_url,
  //       TROOPS_IN_RANGE_QUERY,
  //       {
  //         xMin: x - 20,
  //         xMax: x + 20,
  //         yMin: y - 20,
  //         yMax: y + 20,
  //       }
  //     );

  //     if (response instanceof Error) {
  //       throw response;
  //     }

  //     // Fetch current tick
  //     const currentTick = await fetchCurrentTick();

  //     // Process each troop's stamina
  //     const processedTroops = response.s1EternumExplorerTroopsModels.edges.map(
  //       (edge) => {
  //         const troop = edge.node.troops;
  //         const calculatedStamina = calculateStamina(
  //           troop.stamina,
  //           troop.category,
  //           currentTick
  //         );

  //         return {
  //           ...edge.node,
  //           troops: {
  //             ...troop,
  //             calculatedStamina: {
  //               ...calculatedStamina,
  //               percentFull: Math.round(
  //                 (calculatedStamina.amount / calculatedStamina.maxStamina) *
  //                   100
  //               ),
  //               canTravel:
  //                 calculatedStamina.amount >=
  //                 calculatedStamina.staminaCostForTravel,
  //               canExplore:
  //                 calculatedStamina.amount >=
  //                 calculatedStamina.staminaCostForExplore,
  //             },
  //           },
  //         };
  //       }
  //     );

  //     const memory = ctx.memory;
  //     memory.surrounding = processedTroops;

  //     return {
  //       result: processedTroops,
  //     };
  //   },
  // }),
  // action({
  //   name: "eternum.getExplorerTroops",
  //   description: "Get the current explorer's troops and location",
  //   schema: z.object({}),
  //   async handler(call, ctx, agent) {
  //     const response = await fetchGraphQL<GraphQLResponse>(
  //       torii_url,
  //       EXPLORER_TROOPS_QUERY,
  //       {
  //         explorer_id: explorer_id,
  //       }
  //     );

  //     if (response instanceof Error) {
  //       throw response;
  //     }

  //     const node = response.s1EternumExplorerTroopsModels?.edges?.[0]?.node;
  //     if (!node || !node.coord) {
  //       return { result: null };
  //     }
  //     const { x, y } = node.coord;

  //     // Get node data
  //     const nodeData = response.s1EternumExplorerTroopsModels.edges[0]?.node;

  //     if (!nodeData) {
  //       return { result: null };
  //     }

  //     // Fetch current tick
  //     const currentTick = await fetchCurrentTick();

  //     // Process troops - ensure troops is treated as a single object
  //     const troop = nodeData.troops;
  //     const calculatedStamina = calculateStamina(
  //       troop.stamina,
  //       troop.category,
  //       currentTick
  //     );

  //     const processedTroop = {
  //       ...troop,
  //       calculatedStamina: {
  //         ...calculatedStamina,
  //         percentFull: Math.round(
  //           (calculatedStamina.amount / calculatedStamina.maxStamina) * 100
  //         ),
  //         canTravel:
  //           calculatedStamina.amount >= calculatedStamina.staminaCostForTravel,
  //         canExplore:
  //           calculatedStamina.amount >= calculatedStamina.staminaCostForExplore,
  //       },
  //     };

  //     const memory = ctx.memory;
  //     memory.x = x;
  //     memory.y = y;
  //     memory.troops = processedTroop;

  //     // Return the processed data
  //     return {
  //       result: {
  //         explorer_id: nodeData.explorer_id,
  //         coord: nodeData.coord,
  //         troops: processedTroop,
  //       },
  //     };
  //   },
  // }),
  action({
    name: "eternum.moveExplorer",
    examples: [
      `<action type="eternum.moveExplorer">{"direction": [0,1]}</action>`,
      `<action type="eternum.moveExplorer">{"direction": [0,1,2]}</action>`,
      `<action type="eternum.moveExplorer">{"direction": [0,1,2,3]}</action>`,
      `<action type="eternum.moveExplorer">{"direction": [0,1,2,3,4]}</action>`,
      `<action type="eternum.moveExplorer">{"direction": [0,1,2,3,4,5]}</action>`,
    ],
    description:
      "Move the explorer to a new position. You can move multiple hexes in one action by providing an array of directions. Each direction will be executed in sequence, allowing you to move multiple hexes in one turn. For example, [0, 1] means move East, then NorthEast. Make sure all tiles in your path are explored before attempting multi-direction movement. You can only move in the <available-directions>.",
    schema: z.object({
      direction: z.number().array(),
    }),
    async handler(call, ctx, agent) {
      try {
        // Get the current position and map state from memory
        const memory = ctx.memory;
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
                error: `Cannot move to unexplored tile at (${nextPos.x}, ${nextPos.y}) in direction ${direction}.`,
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

        agent.logger.info(
          "Moving explorer",
          JSON.stringify({
            explorer_id,
            directions: call.direction,
            contract: troop_movement_systems,
            account: account.address,
          })
        );

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
        agent.logger.error(
          "Error moving explorer",
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            explorer_id,
            directions: call.direction,
          })
        );

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
              "Movement failed: One of the tiles in the path is not explored. ",
          };
        }

        return {
          error: errorMessage,
        };
      }
    },
  }),
  action({
    name: "eternum.attackOtherExplorers",
    description:
      "Use this what you need to attack another explorer. Only use this to attack explorers. ",
    schema: z.object({
      aggressor_id: z.number().describe("This is your explorer id"),
      defender_id: z.number().describe("ID of the explorer you want to attack"),
      defender_direction: z.number().describe(
        `Direction to the defender(you have to be adjacent to the defender to attack them):  
        0 → East        1 → Southeast
        2 → Southwest  3 → West
        4 → Northwest  5 → Northeast         
      `
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
            error: `No explored tile in direction ${call.defender_direction}. `,
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
            error: `No entity with ID ${call.defender_id} found in direction ${call.defender_direction}. .`,
          };
        }

        // Fetch defender's resources
        const resourcesResponse = await fetchGraphQL<GraphQLResponse>(
          torii_url,
          RESOURCES_QUERY,
          { entity_id: call.defender_id }
        );

        if (resourcesResponse instanceof Error) {
          throw new Error(
            `Failed to fetch defender resources: ${resourcesResponse.message}`
          );
        }

        // Process defender's resources to determine what can be stolen
        const resourceIdMapping: { [key: string]: number } = {};
        Object.entries(ResourcesIds).forEach(([key, value]) => {
          if (isNaN(Number(key))) {
            resourceIdMapping[key] = value as number;
          }
        });

        const stealableResources = processResourceData(
          resourcesResponse,
          0, // defenderDamage (0 for initial calculation)
          0, // capacityConfigArmy (handled in contract)
          resourceIdMapping
        );

        agent.logger.info(
          "Attacking explorer with resources",
          JSON.stringify({
            stealableResources,
            defender_id: call.defender_id,
          })
        );

        const moveCall: Call = {
          contractAddress: troop_battle_systems!,
          entrypoint: "attack_explorer_vs_explorer",
          calldata: [
            call.aggressor_id,
            call.defender_id,
            call.defender_direction,
            stealableResources.map(({ resourceId, amount }) => [
              resourceId,
              amount,
            ]),
          ],
        };

        const { transaction_hash } = await account.execute(moveCall);

        await account.waitForTransaction(transaction_hash);

        return { result: "success" };
      } catch (error) {
        agent.logger.error(
          "Error attacking explorer",
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            aggressor_id: call.aggressor_id,
            defender_id: call.defender_id,
            direction: call.defender_direction,
          })
        );

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
    name: "eternum.raidStructure",
    description:
      "Raid a structure. You have to be adjacent to the structure to raid it. This will steal resources from the structure.",
    schema: z.object({
      explorer_id: z
        .number()
        .describe("ID of the explorer initiating the attack"),
      structure_id: z.number().describe("ID of the structure being attacked"),
      structure_direction: z.number().describe(
        `Direction to the structure:  
          0 → East       1 → Southeast
          2 → Southwest  3 → West
          4 → Northwest  5 → Northeast 
          `
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
            error: `No explored tile in direction ${call.structure_direction}.`,
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
            error: `No structure with ID ${call.structure_id} found in direction ${call.structure_direction}. `,
          };
        }

        // Fetch structure's resources
        const resourcesResponse = await fetchGraphQL<GraphQLResponse>(
          torii_url,
          RESOURCES_QUERY,
          { entity_id: call.structure_id }
        );

        if (resourcesResponse instanceof Error) {
          throw new Error(
            `Failed to fetch structure resources: ${resourcesResponse.message}`
          );
        }

        // Process structure's resources to determine what can be stolen
        const resourceIdMapping: { [key: string]: number } = {};
        Object.entries(ResourcesIds).forEach(([key, value]) => {
          // Skip numeric keys (from enum reverse mappings)
          if (isNaN(Number(key))) {
            resourceIdMapping[key] = value as number;
          }
        });

        const stealableResources = processResourceData(
          resourcesResponse,
          0, // defenderDamage (0 for initial calculation)
          0, // capacityConfigArmy (handled in contract)
          resourceIdMapping
        );

        agent.logger.info(
          "Attacking structure with resources",
          JSON.stringify({
            stealableResources,
            structure_id: call.structure_id,
          })
        );

        const moveCall: Call = {
          contractAddress: troop_raid_systems!,
          entrypoint: "raid_explorer_vs_guard",
          calldata: [
            call.explorer_id,
            call.structure_id,
            call.structure_direction,
            stealableResources.map(({ resourceId, amount }) => [
              resourceId,
              amount,
            ]),
          ],
        };

        agent.logger.info(
          "Attacking structure",
          JSON.stringify({
            explorer_id: call.explorer_id,
            structure_id: call.structure_id,
            direction: call.structure_direction,
            contract: troop_raid_systems,
          })
        );

        const { transaction_hash } = await account.execute(moveCall);

        await account.waitForTransaction(transaction_hash);

        return { result: "success" };
      } catch (error) {
        agent.logger.error(
          "Error attacking structure",
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            explorer_id: call.explorer_id,
            structure_id: call.structure_id,
            direction: call.structure_direction,
          })
        );

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
    name: "eternum.attackStructure",
    description:
      "Attack a structure. You have to be adjacent to the structure to attack it. Unlike raid, this doesn't steal resources.",
    schema: z.object({
      explorer_id: z
        .number()
        .describe("ID of the explorer initiating the attack"),
      structure_id: z.number().describe("ID of the structure being attacked"),
      structure_direction: z.number().describe(
        `Direction to the structure:  
          0 → East       1 → Southeast
          2 → Southwest  3 → West
          4 → Northwest  5 → Northeast 
          `
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
            error: `No explored tile in direction ${call.structure_direction}.`,
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
            error: `No structure with ID ${call.structure_id} found in direction ${call.structure_direction}.`,
          };
        }

        const moveCall: Call = {
          contractAddress: troop_battle_systems!,
          entrypoint: "attack_explorer_vs_guard",
          calldata: [
            call.explorer_id,
            call.structure_id,
            call.structure_direction,
          ],
        };

        agent.logger.info(
          "Attacking structure",
          JSON.stringify({
            explorer_id: call.explorer_id,
            structure_id: call.structure_id,
            direction: call.structure_direction,
            contract: troop_battle_systems,
          })
        );

        const { transaction_hash } = await account.execute(moveCall);

        await account.waitForTransaction(transaction_hash);

        return { result: "success" };
      } catch (error) {
        agent.logger.error(
          "Error attacking structure",
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            explorer_id: call.explorer_id,
            structure_id: call.structure_id,
            direction: call.structure_direction,
          })
        );

        let errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          error: errorMessage,
        };
      }
    },
  }),
]);

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

      async subscribe(send) {
        const intervalMs = INTERVAL_MINUTES * 60 * 1000;

        console.info(
          "Setting up recurring task",
          JSON.stringify({
            interval_minutes: INTERVAL_MINUTES,
          })
        );

        const intervalId = setInterval(async () => {
          send(
            eternumContext,
            { channelId: "eternum" },
            {
              timestamp: Date.now(),
              message: "Try and move around and attack entities! 💀",
            }
          );
        }, intervalMs);

        return () => {
          clearInterval(intervalId);
        };
      },
    }),
  },
});
