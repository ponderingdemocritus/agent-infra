import { context } from "@daydreamsai/core";
import personaInstructions from "./instructions/persona.md";

import { z } from "zod";
import { generatePersona } from "./utils/generate_persona";

export const persona_context = context({
  type: "persona",
  schema: { id: z.string() },
  key: ({ id }) => id,
  instructions: personaInstructions,
  async create(params, agent) {
    return await generatePersona(parseInt(params.id));
  },
});
