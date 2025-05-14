import { context } from "@daydreamsai/core";
import rulesInstructions from "./instructions/game_rules.md";

export const game_rules_and_directives = context({
  type: "game_rules_and_directives",
  description:
    "This context contains the fundamental rules of the game, agent core operational directives as a player, its defined objectives, and general strategies. It is the primary reference for guiding agent behavior and decision-making processes within the MMORPG",
  instructions: rulesInstructions,
});
