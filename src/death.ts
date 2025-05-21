import { eternum } from "./game/client";

const POLLING_INTERVAL_MS = 30000; // 180 seconds
const SERVER_ENDPOINT =
  "http://dreams-agents-server-service.my-agents.svc.cluster.local:80";

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

export async function checkForDeath({
  explorerId,
  eventId,
}: {
  explorerId: number;
  eventId: number;
}) {
  console.log(
    `Agent configured for Event ID: ${explorerId}, Explorer ID: ${explorerId}`
  );

  console.log(`Starting death polling for Explorer ID: ${explorerId}`);
  const pollInterval = setInterval(async () => {
    console.log(`Polling health for Explorer ID: ${explorerId}...`);
    try {
      const explorer = await eternum.getExplorer(explorerId);

      if (explorer) {
        console.log(
          `Explorer ${explorerId} has no troops. NPC considered dead.`
        );
        clearInterval(pollInterval);
        await signalDeathToServer(eventId.toString());
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
