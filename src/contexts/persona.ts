import { context } from "@daydreamsai/core";
import personaInstructions from "./instructions/persona.md";
import { z } from "zod";
import { type Persona } from "./utils/generate_persona";

export const persona_context = context({
  type: "persona",
  schema: { playerId: z.number() },
  maxWorkingMemorySize: 20,
  key: ({ playerId }) => playerId.toString(),
  instructions: personaInstructions,
  async create({ args }, { memory: { store } }) {
    const persona = await store.get<Persona>("persona");
    return persona;
  },
  async save() {},
});
