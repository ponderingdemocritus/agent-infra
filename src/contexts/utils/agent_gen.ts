import elisa from "../data/personas/agent_elisa_ember_crown_apostle.json";
import yp from "../data/personas/agent_yp.json";
import istarai from "../data/personas/agent_gandalf_the_grey_istari.json";
import apix from "../data/personas/agent_apix.json";
import { generatePersona, type Persona } from "./generate_persona";
import { fetchExplorerTroops } from "../../game/sql";

export enum TroopTier {
  T1 = "T1",
  T2 = "T2",
  T3 = "T3",
}

export enum TroopType {
  Knight = "Knight",
  Paladin = "Paladin",
  Crossbowman = "Crossbowman",
}

// Define agent names
const AGENT_YP_NAME = "Agent YP";
const AGENT_ISTARAI_NAME = "Agent Istarai";
const AGENT_APIX_NAME = "Agent Apix";
const AGENT_ELISA_NAME = "Agent Elisa";

// Internal enum to represent special agent types
enum SpecialAgentType {
  None,
  YP,
  Istarai,
  Apix,
  Elisa,
}

// Total probability for any special agent to appear (e.g., 12 for 12%)
// This means if the roll is 0-11 (inclusive), a special agent is considered.
const SPECIAL_AGENT_ROLL_THRESHOLD = 75;

export const determineSpecialAgentType = (
  troopTier: TroopTier,
  troopType: TroopType,
  entityId: number
): SpecialAgentType => {
  if (troopTier !== TroopTier.T3) return SpecialAgentType.None;

  const specialCharacterRoll = ((entityId * 9301 + 49297) % 233280) % 100;

  if (specialCharacterRoll < SPECIAL_AGENT_ROLL_THRESHOLD) {
    if (troopType === TroopType.Knight) {
      return SpecialAgentType.YP;
    }
    if (troopType === TroopType.Crossbowman) {
      return SpecialAgentType.Istarai;
    }
    // For Apix and Elisa, the original logic used half the threshold.
    // If roll is less than half (e.g. 0-5 for threshold 12), it's Apix.
    // Otherwise (e.g. 6-11), it's Elisa.
    if (specialCharacterRoll < SPECIAL_AGENT_ROLL_THRESHOLD / 2) {
      return SpecialAgentType.Apix;
    } else {
      return SpecialAgentType.Elisa;
    }
  }
  return SpecialAgentType.None;
};

export const getCharacterName = async (
  troopTier: TroopTier,
  troopType: TroopType,
  entityId: number
): Promise<string | undefined> => {
  const agentType = determineSpecialAgentType(troopTier, troopType, entityId);

  switch (agentType) {
    case SpecialAgentType.YP:
      return AGENT_YP_NAME;
    case SpecialAgentType.Istarai:
      return AGENT_ISTARAI_NAME;
    case SpecialAgentType.Apix:
      return AGENT_APIX_NAME;
    case SpecialAgentType.Elisa:
      return AGENT_ELISA_NAME;
    case SpecialAgentType.None:
    default:
      return (await generatePersona(entityId)).name;
  }
};

export const getAgentPersona = async (entityId: number): Promise<Persona> => {
  const troops = await fetchExplorerTroops(entityId);

  const agentType = determineSpecialAgentType(
    troops.troop_tier,
    troops.troop_category,
    entityId
  );

  switch (agentType) {
    case SpecialAgentType.YP:
      return yp as Persona;
    case SpecialAgentType.Istarai:
      return istarai as Persona;
    case SpecialAgentType.Apix:
      return apix as Persona;
    case SpecialAgentType.Elisa:
      return elisa as Persona;
    case SpecialAgentType.None:
    default:
      return await generatePersona(entityId);
  }
};
