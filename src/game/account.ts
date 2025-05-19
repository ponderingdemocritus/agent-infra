import {
  Account,
  CallData,
  constants,
  ec,
  hash,
  RpcProvider,
  stark,
  type Call,
} from "starknet";
import { ownership_systems } from "./extract";
import { CairoCustomEnum, CairoOption, CairoOptionVariant } from "starknet";

// Configuration
const account_address = process.env.ACCOUNT_ADDRESS;
const private_key = process.env.PRIVATE_KEY;
const rpc_url = process.env.RPC_URL;
const argentXaccountClassHash = process.env.ARGENTX_ACCOUNT_CLASS_HASH || "";

if (!account_address || !private_key || !rpc_url || !argentXaccountClassHash) {
  throw new Error("Missing environment variables");
}

// Max retry attempts and delay between retries
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

// Initialize RPC provider
export const rpc = new RpcProvider({
  nodeUrl: rpc_url,
});

// Create master account
export const masterAccount = new Account(
  rpc,
  account_address,
  private_key,
  undefined,
  constants.TRANSACTION_VERSION.V3
);

// Helper function to execute transactions with retry mechanism
export const executeWithRetry = async (
  account: Account,
  calls: Call | Call[],
  maxRetries = MAX_RETRIES
) => {
  let retries = 0;

  while (retries <= maxRetries) {
    try {
      const { transaction_hash } = await account.execute(calls);
      await account.waitForTransaction(transaction_hash);
      return transaction_hash;
    } catch (error: any) {
      retries++;
      console.log(`Transaction attempt ${retries} failed: ${error.message}`);

      if (retries > maxRetries) {
        throw new Error(
          `Failed after ${maxRetries} attempts: ${error.message}`
        );
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

      // If it's a nonce issue, try to refresh the nonce
      if (error.message && error.message.includes("nonce")) {
        console.log("Detected nonce issue, refreshing nonce...");
        await account.getNonce().catch(() => {}); // Refresh nonce
      }
    }
  }
};

export function createAccount(publicKey: string, privateKey: string) {
  // Calculate future address of the ArgentX account
  const axSigner = new CairoCustomEnum({ Starknet: { pubkey: publicKey } });
  const axGuardian = new CairoOption<unknown>(CairoOptionVariant.None);
  const AXConstructorCallData = CallData.compile({
    owner: axSigner,
    guardian: axGuardian,
  });

  const contractAddress = hash.calculateContractAddressFromHash(
    publicKey,
    argentXaccountClassHash,
    AXConstructorCallData,
    0
  );
  console.log("Precalculated account address=", contractAddress);

  const account = new Account(
    rpc,
    contractAddress,
    privateKey,
    undefined,
    constants.TRANSACTION_VERSION.V3
  );

  return account;
}

// Create new account
export const createNewAccount = async ({
  explorer_id,
}: {
  explorer_id: number;
}) => {
  // Generate public and private key pair
  const privateKey = stark.randomAddress();
  console.log("New ArgentX account:\nprivateKey=", privateKey);

  const publicKey = ec.starkCurve.getStarkKey(privateKey);
  console.log("publicKey=", publicKey);

  // Calculate future address of the ArgentX account
  const axSigner = new CairoCustomEnum({ Starknet: { pubkey: publicKey } });
  const axGuardian = new CairoOption<unknown>(CairoOptionVariant.None);
  const AXConstructorCallData = CallData.compile({
    owner: axSigner,
    guardian: axGuardian,
  });

  const contractAddress = hash.calculateContractAddressFromHash(
    publicKey,
    argentXaccountClassHash,
    AXConstructorCallData,
    0
  );

  console.log("Precalculated account address=", contractAddress);

  const account = new Account(
    rpc,
    contractAddress,
    privateKey,
    undefined,
    constants.TRANSACTION_VERSION.V3
  );

  try {
    await transferEth(account.address, "20000000000000000000");
    console.log("✅ ETH transferred");
  } catch (error) {
    console.error("Error transferring ETH:", error);
  }

  try {
    const { transaction_hash, contract_address } = await account.deployAccount({
      classHash: argentXaccountClassHash,
      constructorCalldata: AXConstructorCallData,
      addressSalt: publicKey,
    });

    await rpc.waitForTransaction(transaction_hash);
    console.log(
      "✅ New ArgentX account created.\n   address =",
      contract_address
    );

    await transferAccount(explorer_id, contract_address);
    console.log("✅ Account transferred to ", contract_address, explorer_id);

    return { account, publicKey, privateKey };
  } catch (error) {
    console.error("Error deploying account:", error);
    throw error;
  }
};

// Transfer ETH
export const transferEth = async (to: string, amount: string) => {
  const moveCall: Call = {
    contractAddress:
      "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
    entrypoint: "transfer",
    calldata: [to, amount, "0"],
  };

  return await executeWithRetry(masterAccount, moveCall);
};

// Transfer account ownership
export const transferAccount = async (
  explorer_id: number,
  new_owner: string
) => {
  const moveCall: Call = {
    contractAddress: ownership_systems!,
    entrypoint: "transfer_agent_ownership",
    calldata: [explorer_id, new_owner],
  };

  return await executeWithRetry(masterAccount, moveCall);
};
