import { action, context } from "@daydreamsai/core";
import { eternum } from "../game/client";
import { player_context } from "./player";
import { z } from "zod";
import { BiomeType, TileOccupier } from "../game/types";
import mapInstructions from "./instructions/game_map.md";

// To make human readable coordinates you need to subtract this from the coordinates x,y.
export const CENTER_OF_THE_MAP = 2147483646;

export const game_map_context = context({
  type: "game_map",
  description: `This context represents Agents's knowledge of the game world's geography and its features. `,
  instructions: "\n" + mapInstructions,

  schema: { playerId: z.number() },
  key: ({ playerId }) => playerId.toString(),
  actions: [
    action({
      name: "game_map.get_tiles",
      description: "get the tiles in the game map",
      schema: z.object({}),
      handler(args, ctx) {
        return {
          tiles: ctx.memory.grid,
        };
      },
    }),
  ],

  async create(params, agent) {
    return {
      radius: 10,
      center: { x: 0, y: 0 },
      grid: {},
    };
  },

  async loader({ args, memory }, agent) {
    const player = await agent.getContext({
      context: player_context,
      args,
    });
    // or getTileByOccupier
    const tiles = await eternum.getTilesByRadius({
      pos: player.memory.current_location,
      radius: memory.radius,
    });

    const occupied = tiles.filter((v) => v.occupier_id > 0).map((tile) => tile);

    const explorers = occupied
      .filter((t) => isExplorer(t.occupier_type))
      .map((v) => v.occupier_id);

    const troops = await eternum.getTroopsByExplorers({
      ids: explorers,
    });

    const grid: Record<
      string,
      {
        biome: string;
        entity?: {
          id: number;
          type: string;
          data?: any;
        };
      }
    > = {};

    for (const { col, row, biome, occupier_id, occupier_type } of tiles) {
      const key = `${col},${row}`;

      grid[key] = {
        biome: BiomeType[biome],
      };

      if (occupier_id) {
        grid[key].entity = {
          id: occupier_id,
          type: TileOccupier[occupier_type],
        };

        if (occupier_id === args.playerId) continue;

        if (isExplorer(occupier_type)) {
          grid[key].entity.data = troops.find(
            (explorer) => explorer.id === occupier_id
          );
        }
        // const explorer = explorers.find(explorer => explorer)
      }
    }

    memory.center = player.memory.current_location;
    memory.grid = grid;
    // memory.data = { explorers, occupied };
  },
});

function isExplorer(id: number) {
  return (
    id >= TileOccupier.ExplorerKnightT1Regular &&
    id <= TileOccupier.ExplorerCrossbowmanT3Daydreams
  );
}
