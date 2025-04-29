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

export { TroopType, BiomeType, type StaminaValue, TICKS, TileOccupier };
