**Context: `game_knowledge_base`**

- **Description:**
  This context serves as a structured repository of detailed information about the game's mechanics, elements, entities, and rules. It functions as the AI's primary reference manual for understanding specific game objects like resources, army units, terrain types, status effects, buildings, and potentially core game formulas or mechanics.

- **Instructions for AI Agent (How to use this context):**

  1.  **Reference for Details:** When you encounter a specific game element (e.g., a resource type "Iron Ore," a unit type "Swordsman," a terrain type "Forest") and need detailed information about its properties, stats, effects, or acquisition methods, consult this context.
  2.  **Querying:** Access information by querying specific categories or items (e.g., "Lookup details for 'Swordsman' unit," "Find effects of 'Forest' terrain," "List all available resources"). (Requires the underlying system to support querying this structure).
  3.  **Assume Static (Mostly):** Treat this information as generally static game documentation. While it _could_ be updated if the game rules change fundamentally, it's not meant for dynamic game state like current resource counts or entity locations.
  4.  **Clarify Ambiguities:** If your operational contexts (`player_character`, `game_map`) present information that seems to contradict this knowledge base, prioritize the dynamic operational context but flag the potential discrepancy for review or note it in your reasoning/intentions.

- **Proposed State Structure for `game_knowledge_base` (Example using structured JSON):**

  ```json
  {
    "last_updated": "timestamp_or_version_string",
    "resources": {
      "gold": {
        "description": "Primary currency for trade and upkeep.",
        "acquisition": ["Mines", "Trade", "Raids"],
        "notes": "High demand."
      },
      "wood": {
        "description": "Used for basic construction and some units.",
        "acquisition": ["Forests"],
        "terrain_bonus": { "forest": "abundant" }
      },
      "food": {
        "description": "Consumed by army units each turn.",
        "acquisition": ["Farms", "Gathering (Plains)"],
        "notes": "Shortages cause morale loss."
      },
      "iron": {
        "description": "Required for advanced units and structures.",
        "acquisition": ["Mountains (Iron Vein)"],
        "terrain_bonus": { "mountain_pass": "rich" }
      }
      // ... more resources
    },
    "units": {
      "swordsman": {
        "description": "Basic melee infantry.",
        "cost": { "gold": 50, "food": 10 },
        "stats": { "attack": 10, "defense": 8, "health": 50, "speed": 3 },
        "upkeep": { "food": 1 },
        "abilities": [],
        "counters": ["Archers (at range)"],
        "countered_by": ["Heavy Cavalry"]
      },
      "archer": {
        "description": "Ranged unit.",
        "cost": { "gold": 60, "wood": 10, "food": 5 },
        "stats": {
          "attack": 12,
          "defense": 5,
          "health": 35,
          "speed": 3,
          "range": 5
        },
        "upkeep": { "food": 1 },
        "abilities": ["First Strike (vs melee)"],
        "counters": ["Swordsman (at range)"],
        "countered_by": ["Scouts", "Cavalry"]
      },
      "scout": {
        "description": "Fast unit with high vision.",
        "cost": { "gold": 40, "food": 5 },
        "stats": {
          "attack": 3,
          "defense": 3,
          "health": 25,
          "speed": 6,
          "vision_radius": 4
        },
        "upkeep": { "food": 1 },
        "abilities": ["Stealth (in Forest)"],
        "counters": ["Archers"],
        "countered_by": ["Swordsman"]
      }
      // ... more units
    },
    "terrain": {
      "plains": {
        "description": "Open terrain.",
        "movement_cost": 1,
        "combat_modifier": null,
        "resource_notes": ["Food (gathering)"]
      },
      "forest": {
        "description": "Provides cover, slows movement.",
        "movement_cost": 2,
        "combat_modifier": { "defense_bonus": 2 },
        "resource_notes": ["Wood (abundant)"],
        "special": ["Stealth possible for scouts"]
      },
      "mountain_pass": {
        "description": "Difficult terrain, chokepoint.",
        "movement_cost": 3,
        "combat_modifier": { "defense_bonus": 3 },
        "resource_notes": ["Iron (rich)"]
      }
      // ... more terrain types
    },
    "status_effects": {
      "minor_poison": {
        "description": "Deals damage over time.",
        "effect": { "damage_per_turn": 1 },
        "duration_type": "turns",
        "notes": "Can be cured by 'Antidote' item."
      },
      "blessed_stamina_regen": {
        "description": "Increases stamina recovery.",
        "effect": { "stamina_regen_bonus": 5 },
        "duration_type": "turns"
      }
      // ... more status effects
    },
    "buildings": {
      "barracks": {
        "description": "Allows recruitment of infantry units.",
        "cost": { "wood": 150, "gold": 100 },
        "unlocks": ["Swordsman", "Archer"]
      },
      "farm": {
        "description": "Generates food passively.",
        "cost": { "wood": 50, "gold": 50 },
        "production": { "food_per_turn": 10 }
      }
      // ... more buildings
    }
    // Potentially other categories like "Factions", "Core Mechanics", "Items" etc.
  }
  ```
