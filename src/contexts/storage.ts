import type { MemoryStore } from "@daydreamsai/core";
import { createStorage } from "unstorage";
import fsDriver from "unstorage/drivers/fs";

export function createStore(storagePath: string) {
  const storage = createStorage({
    driver: fsDriver({
      base: storagePath,
    }),
  });

  const store: MemoryStore = {
    ...storage,
    async delete(key) {
      await storage.remove(key);
    },
  };

  return store;
}
