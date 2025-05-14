interface StaminaValue {
  amount: string;
  updated_tick: string;
}

// Tick configuration
const TICKS = {
  Armies: 120, // Armies tick in seconds (example value)
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

enum TileOccupier {
  None = 0,
  RealmRegularLevel1 = 1,
  RealmWonderLevel1 = 2,
  HyperstructureLevel1 = 3,
  FragmentMine = 4,
  Village = 5,
  Bank = 6,
  ExplorerKnightT1Regular = 7,
  ExplorerKnightT2Regular = 8,
  ExplorerKnightT3Regular = 9,
  ExplorerPaladinT1Regular = 10,
  ExplorerPaladinT2Regular = 11,
  ExplorerPaladinT3Regular = 12,
  ExplorerCrossbowmanT1Regular = 13,
  ExplorerCrossbowmanT2Regular = 14,
  ExplorerCrossbowmanT3Regular = 15,
  ExplorerKnightT1Daydreams = 16,
  ExplorerKnightT2Daydreams = 17,
  ExplorerKnightT3Daydreams = 18,
  ExplorerPaladinT1Daydreams = 19,
  ExplorerPaladinT2Daydreams = 20,
  ExplorerPaladinT3Daydreams = 21,
  ExplorerCrossbowmanT1Daydreams = 22,
  ExplorerCrossbowmanT2Daydreams = 23,
  ExplorerCrossbowmanT3Daydreams = 24,
  RealmRegularLevel2 = 25,
  RealmRegularLevel3 = 26,
  RealmRegularLevel4 = 27,
  RealmWonderLevel2 = 28,
  RealmWonderLevel3 = 29,
  RealmWonderLevel4 = 30,
  HyperstructureLevel2 = 31,
  HyperstructureLevel3 = 32,
  RealmRegularLevel1WonderBonus = 33,
  RealmRegularLevel2WonderBonus = 34,
  RealmRegularLevel3WonderBonus = 35,
  RealmRegularLevel4WonderBonus = 36,
  VillageWonderBonus = 37,
  Quest = 38,
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

export {
  TroopType,
  BiomeType,
  type StaminaValue,
  TICKS,
  TileOccupier,
  ResourcesIds,
};
