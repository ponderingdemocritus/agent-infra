import { context } from "@daydreamsai/core";
import personaInstructions from "./instructions/persona.md";

import personaData from "./data/personas/gronk_the_smasher.json";
import { z } from "zod";

export const persona_context = context({
  type: "persona",
  schema: { id: z.string() },
  key: ({ id }) => id,
  instructions: personaInstructions,
  create(params, agent) {
    return personaData;
  },
});
