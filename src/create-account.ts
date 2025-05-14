import { createNewAccount } from "./account";

const account = await createNewAccount({
  explorer_id: parseInt(process.env.EVENT_DATA_1!),
});

console.log({ account });
