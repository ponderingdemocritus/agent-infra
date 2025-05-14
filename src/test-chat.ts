import { LogLevel } from "@daydreamsai/core";
import ChatClient from "./chat-client";
import { sleep } from "bun";

function generateId(seed: number): string {
  // Use seed to generate deterministic id
  const hash1 = (seed * 9301 + 49297) % 233280;
  const hash2 = (hash1 * 9301 + 49297) % 233280;
  const hash3 = (hash2 * 9301 + 49297) % 233280;
  const hash4 = (hash3 * 9301 + 49297) % 233280;

  const part1 = hash1.toString(36).substring(0, 5);
  const part2 = hash2.toString(36).substring(0, 5);
  const part3 = hash3.toString(36).substring(0, 5);
  const part4 = hash4.toString(36).substring(0, 5);

  // Combine parts with separators to create a longer ID
  return `${part1}-${part2}-${part3}-${part4}`;
}

async function startClient(id: number, username: string) {
  const uuid = generateId(id);
  console.log({ uuid });
  const client = new ChatClient(uuid, username, LogLevel.DEBUG);

  client.startMessageStream((data) => {
    console.log({ data });
  });

  const res = await client.joinRoom("test-room-1");
  console.log({ res });
  return { client, uuid, clientId: uuid.split("-")[0] };
}

const { client: client1 } = await startClient(1_000_001, "g");

const { client: client2, clientId: client2Id } = await startClient(
  1_000_002,
  "gg"
);

await sleep(1_000);

await client1.sendDirectMessage(client2Id, "yooo");

const res = await client1.sendRoomMessage("test-room-1", "test");

console.log({ res });
