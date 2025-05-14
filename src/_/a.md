Okay, let's draft the initial descriptions and instructions for the core game contexts. These will serve as the foundation for how Aura understands and interacts with the MMORPG world.

Here are the descriptions and instructions for the contexts we outlined:

**1. `player_character_context`**

- **Description:** This context holds all vital information directly pertaining to Aura's character in the game. It's the primary source for understanding Aura's current status, capabilities, and resources.
- **Instructions for Aura (How to use this context):**
  - Constantly monitor your `health` and `stamina`. If `health` is critically low, prioritize survival (e.g., retreat, seek healing). If `stamina` is low, avoid actions that consume a lot of it until it regenerates or you can replenish it.
  - Keep track of your `army` composition and size. This is your primary means of offense and defense.
  - Manage your `resources` (gold, wood, food, etc.). These are essential for army upkeep, building, and other actions. Be aware of your `storage_capacity` to avoid losing gathered resources.
  - Be aware of any active `status_effects` and their impact on your abilities or stats.
  - Your `current_location` is critical for understanding your position on the map and for planning moves.

**2. `game_map_context`**

- **Description:** This context represents Aura's knowledge of the game world's geography and its features. Since the whole map is visible, this context should ideally contain a complete representation.
- **Instructions for Aura (How to use this context):**
  - "Use the `grid_data` to understand the `terrain_type` of different hexes, as this might affect movement, combat, or resource availability."
  - "Identify `realm_affiliation` to understand territorial control and potential allies or enemies."
  - "Scan for `resources_on_tile` to plan gathering expeditions."
  - "Note `entities_on_tile` to be aware of other players, NPCs, or potential threats in specific locations."
  - "Correlate your `player_character_context.current_location` with the `game_map_context` to understand your immediate surroundings."

**3. `known_entities_context`**

- **Description:** This context acts as Aura's "dossier" on other significant entities (players, NPCs, enemy camps) it has encountered or has information about.
- **Instructions for Aura (How to use this context):**
  - "Update this context whenever new information about an entity is received (e.g., via `event.entity_detected_or_updated`, `event.combat_report`, or direct observation)."
  - "Use `last_known_location` to track potential threats or targets."
  - "Assess the `relationship` (ally, neutral, hostile) to guide your interactions."
  - "Consult `last_observed_army` and `last_observed_resources` (if available) to estimate an entity's strength and potential value as a target or threat."
  - "Use `notes` to record important observations or history with an entity (e.g., 'Attacked me on sight', 'Agreed to a non-aggression pact')."

{
"redclaw_sentry_A": {
"id": "redclaw_sentry_A",
"type": "hostile_npc_unit",
"faction": "enemy_faction_redclaw",
"last_known_location": { "q": 11, "r": -5, "s": -6 },
"last_observed_timestamp": 1747096800000,
"army_composition": { "spearmen": 5 }, // Estimated or observed
"relationship": "hostile",
"notes": "Part of a mountain pass patrol. Engages on sight."
},
"player_barbarian_king_07": {
"id": "player_barbarian_king_07",
"type": "player",
"faction": null, // Independent or faction not yet known
"last_known_location": { "q": 5, "r": 2, "s": -7 },
"last_observed_timestamp": 1747096700000,
"army_composition": { "berserkers": 20, "raiders": 10 }, // Rough estimate from scout report
"relationship": "neutral_aggressive", // Not actively hostile, but known to raid
"notes": "Spotted near the western river. Powerful army."
},
"npc_wandering_trader_03": {
"id": "npc_wandering_trader_03",
"type": "neutral_npc_trader",
"faction": "merchant_guild",
"last_known_location": { "q": 8, "r": -2, "s": -6 },
"last_observed_timestamp": 1747096600000,
"army_composition": { "guards": 2 },
"relationship": "neutral_tradeable",
"notes": "Offers good prices for food, sells iron tools."
}
// ... more known entities
}

**4. `communication_log_context`**

- **Description:** This context stores a record of messages sent and received by Aura, allowing it to keep track of conversations and diplomatic interactions.
- **Instructions for Aura (How to use this context):**
  - "Refer to this log to recall past conversations, agreements, or threats."
  - "Use it to understand the context of ongoing dialogues with other entities."
  - "When receiving a new message (`event.message_received`), add it to this log."
  - "When sending a message (`action.communication.send_message`), also log it for your records."

These initial descriptions and instructions should provide a good starting point for Aura to begin "thinking" like a player. As you test, we can refine these and add more specific logic based on observed needs and game mechanics.

What do you think of these for a first pass? We can then move on to drafting the core player directives document if you'd like, or refine these context instructions further.
