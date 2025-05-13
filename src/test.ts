import {
  createDreams,
  formatPromptSections,
  formatXml,
  mainPrompt,
  prepareContexts,
} from "@daydreamsai/core";

import { player_context } from "./contexts/player";
import { game_map_context } from "./contexts/game_map";
import { eternum } from "./game/client";
import {
  calculateHexDistance,
  findPathToTarget,
  generateASCIIMap,
} from "./game/utils";
import { findShortestPath } from "./game/pathfinding";
import { persona_context } from "./contexts/persona";
import { intentions_context } from "./contexts/intentions";

const agent = createDreams({});

const player = await agent.getContext({
  context: player_context,
  args: { playerId: 500 },
});

const workingMemory = await agent.getWorkingMemory(player.id);

const states = await prepareContexts({
  agent,
  ctxState: player,
  workingMemory,
  params: {
    contexts: [
      { context: persona_context, args: { id: "gronk_the_smasher" } },
      { context: game_map_context, args: { playerId: 500 } },
      { context: intentions_context, args: { playerId: 500 } },
    ],
  },
});

const { contexts } = formatPromptSections({ ...states, workingMemory });

// console.clear();
console.log(formatXml(contexts));

// const { x, y } = { x: 2147483648, y: 2147483581 };
// const distance = calculateHexDistance(
//   x,
//   y,
//   player.memory.current_location.x,
//   player.memory.current_location.y
// );

// const tiles = await eternum.getTilesByRadius({
//   pos: player.memory.current_location,
//   radius: 10,
// });

// const path = findShortestPath(
//   {
//     x: player.memory.current_location.x,
//     y: player.memory.current_location.y,
//   },
//   { x: x, y: y },
//   new Map(tiles.map((tile) => [`${tile.col},${tile.row}`, tile])),
//   100
// );

// console.log({ loc: player.memory.current_location, path, distance });
// console.log(
//   generateASCIIMap(
//     tiles,
//     player.memory.current_location.x,
//     player.memory.current_location.y
//   )
// );
