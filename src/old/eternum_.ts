import { z } from "zod";
import { action, extension, fetchGraphQL, render } from "@daydreamsai/core";
import { context } from "@daydreamsai/core";
import type { Call } from "starknet";
import {
  troop_battle_systems,
  troop_movement_systems,
  troop_raid_systems,
} from "../game/extract";
import {
  EXPLORER_TROOPS_QUERY,
  TROOPS_IN_RANGE_QUERY,
  TILES_QUERY,
  RESOURCES_QUERY,
  type GraphQLResponse,
} from "../game/queries";
import { BiomeType, ResourcesIds, TileOccupier } from "../game/types";
import {
  generateASCIIMap,
  calculateStamina,
  fetchCurrentTick,
  getNeighborCoord,
  findAdjacentEntities,
  findNearestEntity,
  processResourceData,
  RESOURCES_WEIGHTS_NANOGRAM,
  calculateHexDistance,
} from "../game/utils";
import {
  createAccount,
  createNewAccount,
  transferAccount,
} from "../game/account";

const INTERVAL_MINUTES = 0.2;
const MAP_RADIUS = 25;

const explorer_id = 500;

const torii_url =
  "https://api.cartridge.gg/x/eternum-sepolia-interim/torii/graphql";

console.info("Initializing eternum extension", JSON.stringify({ explorer_id }));

// const account = await createNewAccount({ explorer_id });

// // // Initialize account
const account = createAccount(
  "0xea8300739b22cef9eab0515cb1453789a78657e412fbc3d1526a2dd946d7ea",
  "0x18a78a816c5e9bef489ee27700b5064b90e67c79a9c5f564a5d19f8b7a10315"
);

type Tile = {
  biome: number;
  col: number;
  row: number;
  occupier_id?: number;
  occupier_type?: number;
};

type TroopStamina = {
  percentFull: number;
  canTravel: boolean;
  canExplore: boolean;
  amount: number;
  updated_tick: number;
  maxStamina: number;
  staminaCostForTravel: number;
  staminaCostForExplore: number;
};

type Troop = {
  tier: number;
  category: string;
  count: number;
  stamina: TroopStamina;
};

type EternumMemory = {
  x: number;
  y: number;
  troops: Troop | null;
  surrounding: {
    explorer_id: number;
    coord: {
      x: number;
      y: number;
    };
    distance: number;
    troops: Troop;
  }[];
  mapState: {
    tiles: Tile[];
    exploredTiles: Record<string, Tile>;
    occupiedTiles: Record<string, number>;
    adjacentEntities: Array<{
      direction: number;
      col: number;
      row: number;
      occupier_id: number;
      distance: number;
    }>;
    nearestEntities: Array<{
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
    }>;
    availableDirections: Array<number>;
    recommendedPath: Array<number> | undefined;
    lastUpdated: number;
  };
};

type AdjecentEntities = EternumMemory["mapState"]["adjacentEntities"];
type NearestEntities = EternumMemory["mapState"]["nearestEntities"];
