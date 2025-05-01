import { fetchGraphQL } from "@daydreamsai/core";
import { EXPLORER_TROOPS_QUERY, type GraphQLResponse } from "./queries";

const GRAPHQL_ENDPOINT =
  process.env.GRAPHQL_ENDPOINT ||
  "https://api.cartridge.gg/x/eternum-sepolia-interim/torii/graphql";
const POLLING_INTERVAL_MS = 30000; // 180 seconds
const SERVER_ENDPOINT =
  "http://dreams-agents-server-service.my-agents.svc.cluster.local:80";

const explorer_id = parseInt(process.env.EVENT_DATA_1 || "195");

async function signalDeathToServer(eventId: string) {
  const signalUrl = `${SERVER_ENDPOINT}/signal-death/${encodeURIComponent(
    eventId
  )}`;
  console.log(
    `NPC death detected for event ID ${eventId}. Sending signal to ${signalUrl}`
  );
  try {
    const response = await fetch(signalUrl, { method: "DELETE" });
    if (response.ok) {
      console.log(`Successfully signaled death for event ID ${eventId}.`);
    } else {
      console.error(
        `Failed to signal death for event ID ${eventId}. Status: ${response.status}`
      );
    }
  } catch (error) {
    console.error(`Error sending death signal for event ID ${eventId}:`, error);
  }
}

export async function checkForDeath() {
  console.log("Agent starting...");
  const explorerId = process.env.EVENT_ID_1;

  const eventId = process.env.EVENT_ID;

  if (explorerId === null) {
    console.error(
      `FATAL: Missing EVENT_ID ('${explorerId}') or couldn't parse explorer_id ('${explorerId}') from env. Exiting.`
    );
    process.exit(1);
  }

  console.log(
    `Agent configured for Event ID: ${explorerId}, Explorer ID: ${explorerId}`
  );

  // --- Start Core Agent Logic ---
  console.log("Running main agent task...");
  // await performAgentActions(explorerId); // Your main logic here

  // --- Start Polling ---
  console.log(`Starting death polling for Explorer ID: ${explorerId}`);
  const pollInterval = setInterval(async () => {
    console.log(`Polling health for Explorer ID: ${explorerId}...`);
    try {
      const response = await fetchGraphQL<GraphQLResponse>(
        GRAPHQL_ENDPOINT,
        EXPLORER_TROOPS_QUERY,
        { explorer_id: explorer_id }
      );

      if (response instanceof Error) {
        throw response;
      }

      console.log("GraphQL query successful.");

      const troops = response.s1EternumExplorerTroopsModels.edges;

      if (Array.isArray(troops) && troops.length === 0) {
        console.log(
          `Explorer ${explorerId} has no troops. NPC considered dead.`
        );
        clearInterval(pollInterval);
        await signalDeathToServer(eventId || "");
        console.log(`Exiting agent process for Event ID ${explorerId}.`);
        process.exit(0);
      } else {
        console.log(`Explorer ${explorerId} still alive. Continuing polling.`);
      }
    } catch (error) {
      console.error(
        `Error during health poll for Explorer ID ${explorerId}:`,
        error
      );
    }
  }, POLLING_INTERVAL_MS);

  console.log("Agent running. Polling started.");
}
