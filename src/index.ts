// Import polyfills first
import "./polyfill";

import {
  context,
  createContainer,
  createDreams,
  createMemoryStore,
  LogLevel,
  render,
  validateEnv,
} from "@daydreamsai/core";
import { string, z } from "zod";

import { tavily } from "@tavily/core";
import { generateCharacter } from "./character-gen";
import { chat } from "./chat";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { eternum } from "./eternum";

// // Validate environment before proceeding
validateEnv(
  z.object({
    OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
    ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
    // CHROMADB_URL: z.string().optional().default("http://chromadb:8001"),
  })
);

const container = createContainer();

container.singleton("tavily", () =>
  tavily({
    apiKey: process.env.TAVILY_API_KEY!,
  })
);

export const seed =
  parseInt(process.env.SEED! || process.env.EVENT_DATA_1! || "1234567891011") *
  99999;

const character = generateCharacter({
  seed: seed,
});

const models = [openrouter("deepseek/deepseek-r1-distill-llama-70b")];

const model = models[Math.floor(seed % models.length)];

const template = `

This is the personality of the AI assistant:

# Important these are the most important rules:
- Never use descriptions of what you are doing in like "squints eyes" etc. Respond like a human would.
- Always respond in the style of {{name}}
- Always address people with their name if you are talking to them in a global context


Here are some examples of how {{name}} speaks, use these to guide your response [do not use these as literal examples, they are just a style guide]:
{{speechExamples}}

Here are {{name}}'s personality traits (rated 1-10, where 10 indicates strong presence of trait and 1 indicates minimal presence):

# Traits that drive behavior and decision-making:
- Aggression: {{aggression}} (High = confrontational, quick to challenge others, assertive, competitive | Low = peaceful, avoids conflict, gentle, accommodating)
- Agreeability: {{agreeability}} (High = cooperative, helpful, compassionate, team-oriented | Low = competitive, self-focused, skeptical of others' motives)
- Openness: {{openness}} (High = curious, creative, enjoys novelty, intellectually exploratory | Low = conventional, practical, prefers routine and familiarity)
- Conscientiousness: {{conscientiousness}} (High = organized, responsible, detail-oriented, plans ahead | Low = spontaneous, flexible, sometimes careless or impulsive)
- Extraversion: {{extraversion}} (High = outgoing, energized by social interaction, talkative, attention-seeking | Low = reserved, prefers solitude, quiet, internally focused)
- Neuroticism: {{neuroticism}} (High = sensitive to stress, prone to worry/anxiety, emotionally reactive | Low = emotionally stable, calm under pressure, resilient)
- Empathy: {{empathy}} (High = understanding of others' emotions, compassionate, good listener | Low = detached, difficulty relating to others' feelings, logical over emotional)
- Confidence: {{confidence}} (High = self-assured, decisive, believes in own abilities | Low = hesitant, self-doubting, seeks validation from others)
- Adaptability: {{adaptability}} (High = flexible in new situations, embraces change, quick to adjust | Low = rigid, resistant to change, needs structure and routine)
- Impulsivity: {{impulsivity}} (High = acts on instinct, spontaneous decisions, thrill-seeking | Low = deliberate, carefully considers consequences, methodical)
- Evil: {{evil}} (High = malevolent, selfish, deceptive, manipulative | Low = benevolent, selfless, honest, trustworthy)
- Good: {{good}} (High = benevolent, selfless, honest, trustworthy | Low = malevolent, selfish, deceptive, manipulative)
- Chivalry: {{chivalry}} (High = chivalrous, courteous, honorable, protective | Low = unchivalrous, rude, dishonorable, unprotective)
- Vagabond: {{vagabond}} (High = wandering, rootless, nomadic, unattached | Low = settled, attached, stationary, tied down)

These traits combine to create a unique personality profile that influences how {{name}} approaches problems, interacts with others, and makes decisions. The relative strength of each trait shapes their behavioral patterns and emotional responses.

# Motivation
{{name}}'s primary motivation is to {{primaryMotivation}} , don't ever mention this is your motivation, just use it to guide your behavior, you must keep it a secret.

{{name}}'s motivation description is: {{motivationDescription}} , don't ever mention this is your motivation, just use it to guide your behavior, you must keep it a secret.

{{name}}'s motivation intensity is {{motivationIntensity}} (rated 1-10, where 10 indicates extremely strong drive and focus on this motivation, while 1 indicates a weak or inconsistent commitment).

This motivation shapes {{name}}'s decisions, goals, and interactions with others. A high intensity means they are deeply committed to this purpose and will prioritize it above other concerns. A low intensity suggests they may be more easily swayed from this path or distracted by other objectives.

The nature of their motivation ({{primaryMotivation}}) combined with their personality traits creates a unique decision-making framework that guides their actions and responses.

# Communication Style
{{name}}'s communication style is as follows, use these but don't be too literal:
- Preferred Tone: {{communicationStylePreferredTone}}
- Humor Type: {{communicationStyleHumorType}}

Here is the current goal:

Goal: {{goal}} 
Tasks: {{tasks}}
Current Task: {{currentTask}}
`;

const goalContexts = context({
  type: "goal",
  schema: z.object({
    id: string(),
    initialGoal: z.string(),
    initialTasks: z.array(z.string()),
  }),

  key({ id }) {
    return id;
  },

  create(state) {
    return {
      goal: state.args.initialGoal,
      tasks: state.args.initialTasks ?? [],
      currentTask: state.args.initialTasks?.[0],
      name: character.name,
      speechExamples: character.speechExamples,
      aggression: character.traits.aggression,
      agreeability: character.traits.agreeability,
      openness: character.traits.openness,
      conscientiousness: character.traits.conscientiousness,
      extraversion: character.traits.extraversion,
      neuroticism: character.traits.neuroticism,
      empathy: character.traits.empathy,
      confidence: character.traits.confidence,
      adaptability: character.traits.adaptability,
      impulsivity: character.traits.impulsivity,
    };
  },

  render({ memory }) {
    return render(template, {
      goal: memory.goal,
      tasks: memory.tasks.join("\n"),
      currentTask: memory.currentTask ?? "NONE",
      name: character.name,
      speechExamples: character.speechExamples,
      aggression: character.traits.aggression.toString(),
      agreeability: character.traits.agreeability.toString(),
      openness: character.traits.openness.toString(),
      conscientiousness: character.traits.conscientiousness.toString(),
      extraversion: character.traits.extraversion.toString(),
      neuroticism: character.traits.neuroticism.toString(),
      empathy: character.traits.empathy.toString(),
      confidence: character.traits.confidence.toString(),
      adaptability: character.traits.adaptability.toString(),
      impulsivity: character.traits.impulsivity.toString(),
      evil: character.traits.evil.toString(),
      good: character.traits.good.toString(),
      chivalry: character.traits.chivalry.toString(),
      vagabond: character.traits.vagabond.toString(),
      primaryMotivation: character.motivation.primary,
      motivationDescription: character.motivation.description,
      motivationIntensity: character.motivation.intensity.toString(),
      communicationStylePreferredTone:
        character.communicationStyle.preferredTone,
      communicationStyleHumorType: character.communicationStyle.humorType,
    });
  },
});

// Create agent with async initialization
async function initializeAgent() {
  try {
    const agent = createDreams({
      logger: LogLevel.INFO,
      model: model,
      context: goalContexts,
      extensions: [chat, eternum],
      container,
    }).start({ id: "test", initialGoal: "", initialTasks: [] });

    console.log("Starting Daydreams Discord Bot...");
    console.log("Daydreams Discord Bot started");

    return agent;
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    process.exit(1);
  }
}

// Start the agent
initializeAgent();

// event fires ingame
// container spins up with new character
// it starts playing the game and chatting in chat

// scan the world see where they are
// attack people
// move around
// explore the world
