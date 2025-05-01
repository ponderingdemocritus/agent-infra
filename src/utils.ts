import {
  BiomeType,
  TICKS,
  TroopType,
  type StaminaValue,
  TileOccupier,
} from "./types";

// Simple logger for container environment
export const logger = {
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

// Configuration for troops
export const TROOP_STAMINA_CONFIG = {
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
export const WORLD_CONFIG = {
  troop_stamina_config: {
    stamina_gain_per_tick: 1, // Stamina gained per tick
    stamina_initial: 100, // Initial stamina
    stamina_bonus_value: 10, // Bonus/penalty for biome effects
    stamina_travel_stamina_cost: 30, // Base cost for travel
    stamina_explore_stamina_cost: 20, // Cost for exploration
  },
};

// Get the troop type from string
export function getTroopType(category: string): TroopType {
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
export function getTravelStaminaCost(
  biome: BiomeType,
  troopType: TroopType
): number {
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
export function calculateStamina(
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
export async function fetchCurrentTick(): Promise<number> {
  // This is a placeholder, ideally you would get this from the blockchain or an API
  // For testing, we can return a large number to simulate the current tick
  const currentTimestamp = Math.floor(Date.now() / 1000);
  // Convert timestamp to game ticks (assuming armies tick is 15 seconds)
  return Math.floor(currentTimestamp / TICKS.Armies);
}

enum ResourcesIds {
  Stone = 1,
  Coal = 2,
  Wood = 3,
  Copper = 4,
  Ironwood = 5,
  Obsidian = 6,
  Gold = 7,
  Silver = 8,
  Mithral = 9,
  AlchemicalSilver = 10,
  ColdIron = 11,
  DeepCrystal = 12,
  Ruby = 13,
  Diamonds = 14,
  Hartwood = 15,
  Ignium = 16,
  TwilightQuartz = 17,
  TrueIce = 18,
  Adamantine = 19,
  Sapphire = 20,
  EtherealSilica = 21,
  Dragonhide = 22,
  Labor = 23,
  AncientFragment = 24,
  Donkey = 25,
  Knight = 26,
  KnightT2 = 27,
  KnightT3 = 28,
  Crossbowman = 29,
  CrossbowmanT2 = 30,
  CrossbowmanT3 = 31,
  Paladin = 32,
  PaladinT2 = 33,
  PaladinT3 = 34,
  Wheat = 35,
  Fish = 36,
  Lords = 37,
}

export const RESOURCES_WEIGHTS_NANOGRAM: { [key in ResourcesIds]: number } = {
  [ResourcesIds.Wood]: 1000,
  [ResourcesIds.Stone]: 1000,
  [ResourcesIds.Coal]: 1000,
  [ResourcesIds.Copper]: 1000,
  [ResourcesIds.Obsidian]: 1000,
  [ResourcesIds.Silver]: 1000,
  [ResourcesIds.Ironwood]: 1000,
  [ResourcesIds.ColdIron]: 1000,
  [ResourcesIds.Gold]: 1000,
  [ResourcesIds.Hartwood]: 1000,
  [ResourcesIds.Diamonds]: 1000,
  [ResourcesIds.Sapphire]: 1000,
  [ResourcesIds.Ruby]: 1000,
  [ResourcesIds.DeepCrystal]: 1000,
  [ResourcesIds.Ignium]: 1000,
  [ResourcesIds.EtherealSilica]: 1000,
  [ResourcesIds.TrueIce]: 1000,
  [ResourcesIds.TwilightQuartz]: 1000,
  [ResourcesIds.AlchemicalSilver]: 1000,
  [ResourcesIds.Adamantine]: 1000,
  [ResourcesIds.Mithral]: 1000,
  [ResourcesIds.Dragonhide]: 1000,
  [ResourcesIds.Labor]: 1000,
  [ResourcesIds.AncientFragment]: 1000,
  [ResourcesIds.Donkey]: 0,
  [ResourcesIds.Knight]: 5000,
  [ResourcesIds.KnightT2]: 5000,
  [ResourcesIds.KnightT3]: 5000,
  [ResourcesIds.Crossbowman]: 5000,
  [ResourcesIds.CrossbowmanT2]: 5000,
  [ResourcesIds.CrossbowmanT3]: 5000,
  [ResourcesIds.Paladin]: 5000,
  [ResourcesIds.PaladinT2]: 5000,
  [ResourcesIds.PaladinT3]: 5000,
  [ResourcesIds.Lords]: 0,
  [ResourcesIds.Wheat]: 100,
  [ResourcesIds.Fish]: 100,
};

// Helper function to generate a simplified ASCII map view
export function generateASCIIMap(
  tiles: Array<{
    biome: number;
    col: number;
    row: number;
    occupier_id?: number;
    occupier_type?: number;
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
      occupier_type?: number;
    }
  > = {};

  // Track occupier details for reference section
  const occupierDetails: Array<{
    col: number;
    row: number;
    occupier_id: number;
    occupier_type: number;
  }> = [];

  tiles.forEach((tile) => {
    const key = `${tile.col},${tile.row}`;
    tileMap[key] = tile;

    // Add to occupier details if tile has an occupier
    if (
      tile.occupier_id &&
      tile.occupier_type !== undefined &&
      tile.occupier_type !== TileOccupier.None
    ) {
      occupierDetails.push({
        col: tile.col,
        row: tile.row,
        occupier_id: tile.occupier_id,
        occupier_type: tile.occupier_type,
      });
    }
  });

  // Check available directions from current position
  const availableDirections: number[] = [];
  for (let direction = 0; direction < 6; direction++) {
    const neighbor = getNeighborCoord(currentX, currentY, direction);
    const neighborKey = `${neighbor.x},${neighbor.y}`;

    // A direction is available if the tile exists and is not occupied
    if (
      tileMap[neighborKey] &&
      (!tileMap[neighborKey].occupier_type ||
        tileMap[neighborKey].occupier_type === TileOccupier.None)
    ) {
      availableDirections.push(direction);
    }
  }

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
        // Use occupier_type if available, otherwise show biome
        if (
          tile.occupier_type !== undefined &&
          tile.occupier_type !== TileOccupier.None
        ) {
          // Use occupier type number
          const occupierChar = tile.occupier_type.toString().padEnd(1);
          row += occupierChar + " ";
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

  // Add an updated legend
  asciiMap += "\nLegend:\n";
  asciiMap += "O = Your position\n";
  asciiMap += "· = Unexplored/Unknown\n";
  asciiMap += "Letters = Biome types (G=Grassland, O=Ocean, etc.)\n";
  asciiMap += "Numbers = Occupied tiles (see types below)\n";

  // Add available directions section
  asciiMap +=
    "\nIMPORTANT: <available-directions> Available Directions (you can only move in these directions):\n";
  if (availableDirections.length === 0) {
    asciiMap += "No available directions to move!\n";
  } else {
    const directionNames = [
      "0: East",
      "1: Southeast",
      "2: Southwest",
      "3: West",
      "4: Northwest",
      "5: Northeast",
    ];

    asciiMap +=
      availableDirections.map((dir) => directionNames[dir]).join(", ") + "\n";
  }
  asciiMap += "</available-directions>\n";

  // Add occupier reference section if there are any occupiers
  if (occupierDetails.length > 0) {
    asciiMap += "\nOccupier Details (Position, Type, ID):\n";
    occupierDetails.forEach((occupier) => {
      // Find the enum key by value in a type-safe way
      const typeName =
        Object.entries(TileOccupier).find(
          ([key, val]) => isNaN(Number(key)) && val === occupier.occupier_type
        )?.[0] || "Unknown";
      asciiMap += `(${occupier.col},${occupier.row}) - Type: ${occupier.occupier_type} (${typeName}), ID: ${occupier.occupier_id}\n`;
    });
  }

  // Add TileOccupier types to the legend
  asciiMap += "\nOccupier Types (Attack Priority: P1=Highest)\n";
  for (const [key, value] of Object.entries(TileOccupier)) {
    if (isNaN(Number(key))) {
      // Only include string keys
      let priority = "(Non-Attackable)";
      if (key.startsWith("Explorer")) {
        priority = "(P1: Attack)";
      } else if (key.startsWith("Realm")) {
        priority = "(P2: Attack)";
      } else if (key.startsWith("Village") || key.startsWith("FragmentMine")) {
        priority = "(P3: Attack)";
      } else if (key.startsWith("Bank")) {
        priority = "(P4: Attack)";
      }
      asciiMap += `${value}: ${key} ${priority}\n`;
    }
  }

  // Add direction compass
  asciiMap += "\nDirections:\n";
  asciiMap += "    4(NW)  5(NE)\n";
  asciiMap += "3(W)   O   0(E)\n";
  asciiMap += "    2(SW)  1(SE)\n";

  return asciiMap;
}

// Helper function to get the correct neighbor coordinates based on row parity (even/odd)
export function getNeighborCoord(
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
export function findAdjacentEntities(
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
export function findNearestEntity(
  exploredTiles: Record<
    string,
    {
      biome: number;
      col: number;
      row: number;
      occupier_id?: number;
      occupier_type?: number;
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
    occupier_type: number;
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
      occupier_type: tile.occupier_type!,
      distance: calculateHexDistance(currentX, currentY, tile.col, tile.row),
    }))
    .filter((entity) => entity.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);

  type EntityWithPath = {
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
export function calculateHexDistance(
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
export function findPathToTarget(
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

export const nanogramToKg = (value: number) => {
  return value / 10 ** 12;
};

export const getRemainingCapacityInKg = (resource: any) => {
  const weight = resource?.weight;

  if (!weight) return 0;

  return nanogramToKg(Number(weight.capacity - weight.weight)) || 0;
};

export const getRemainingCapacity = (
  resource: any,
  defenderDamage: number,
  capacityConfigArmy: number
) => {
  const remainingCapacity = getRemainingCapacityInKg(resource);
  const remainingCapacityAfterRaid =
    remainingCapacity - (defenderDamage || 0) * capacityConfigArmy;

  return {
    beforeRaid: remainingCapacity,
    afterRaid: remainingCapacityAfterRaid,
  };
};

export const getStealableResources = (
  capacityAfterRaid: number,
  targetArmyResources: Array<{ resourceId: number; amount: number }>,
  divideByPrecision: (value: number) => number,
  getResourceWeightKg: (resourceId: number) => number
) => {
  const stealableResources: Array<{ resourceId: number; amount: number }> = [];

  // If no capacity, return empty array immediately
  if (capacityAfterRaid <= 0) {
    return stealableResources;
  }

  let remainingCapacity = capacityAfterRaid;

  [...targetArmyResources]
    .sort((a, b) => b.amount - a.amount)
    .forEach((resource) => {
      const availableAmount = divideByPrecision(resource.amount);
      const resourceWeight = getResourceWeightKg(resource.resourceId);

      if (remainingCapacity > 0) {
        let maxStealableAmount;
        if (resourceWeight === 0) {
          // If resource has no weight, can take all of it
          maxStealableAmount = availableAmount;
        } else {
          maxStealableAmount = Math.min(
            Math.floor(Number(remainingCapacity) / Number(resourceWeight)),
            availableAmount
          );
        }

        if (maxStealableAmount > 0) {
          stealableResources.push({
            ...resource,
            amount: maxStealableAmount,
          });
        }

        remainingCapacity -= maxStealableAmount * Number(resourceWeight);
      }
    });

  return stealableResources;
};

export const processResourceData = (
  resourceData: any,
  defenderDamage = 0,
  capacityConfigArmy = 0,
  resourcesIds: { [key: string]: number }
): Array<{ resourceId: number; amount: number }> => {
  if (!resourceData?.data?.s1EternumResourceModels?.edges?.[0]?.node) {
    return [];
  }

  const resourceNode = resourceData.data.s1EternumResourceModels.edges[0].node;
  const capacity = {
    capacity: parseInt(resourceNode.weight.capacity, 16),
    weight: parseInt(resourceNode.weight.weight, 16),
  };

  // Create resource object needed by getRemainingCapacityInKg
  const resourceObj = { weight: capacity };

  // Calculate remaining capacity
  const remainingCapacity = getRemainingCapacity(
    resourceObj,
    defenderDamage,
    capacityConfigArmy
  );

  // Extract all resources with non-zero balances
  const availableResources = Object.entries(resourceNode)
    .filter(([key, value]) => key.endsWith("_BALANCE") && value !== "0x0")
    .map(([key, value]) => {
      const resourceName = key.replace("_BALANCE", "");
      return {
        resourceId: resourcesIds[resourceName] || 0, // Use the provided resourcesIds map
        amount: parseInt(value as string, 16),
      };
    });

  // Get stealable resources based on capacity
  // Provide a type–safe lookup for the nanogram weight table
  const weightInKg = (resourceId: number): number =>
    nanogramToKg(
      // Cast the constant map to Record<number, number> so generic numbers are allowed
      (RESOURCES_WEIGHTS_NANOGRAM as Record<number, number>)[resourceId] ?? 0
    );

  return getStealableResources(
    remainingCapacity.afterRaid,
    availableResources,
    divideByPrecision, // pass function reference directly
    weightInKg // use the typed weight accessor
  );
};

export const RESOURCE_PRECISION = 1_000_000_000;

export function divideByPrecision(
  value: number,
  floor: boolean = true
): number {
  return floor
    ? Math.floor(value / RESOURCE_PRECISION)
    : value / RESOURCE_PRECISION;
}
