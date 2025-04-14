import {
  Account,
  CallData,
  ec,
  hash,
  RpcProvider,
  stark,
  type Call,
} from "starknet";
import { ownership_systems } from "./extract";
import { CairoCustomEnum, CairoOption, CairoOptionVariant } from "starknet";

// Configuration
const account_address =
  "0x01BFC84464f990C09Cc0e5D64D18F54c3469fD5c467398BF31293051bAde1C39";
const private_key =
  "0x075362a844768f31c8058ce31aec3dd7751686440b4f220f410ae0c9bf042e60";
const rpc_url =
  "https://starknet-sepolia.blastapi.io/de586456-fa13-4575-9e6c-b73f9a88bc97/rpc/v0_7";
const argentXaccountClassHash =
  "0x036078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f";

// Max retry attempts and delay between retries
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

// Initialize RPC provider
export const rpc = new RpcProvider({
  nodeUrl: rpc_url,
});

// Create master account
export const masterAccount = new Account(rpc, account_address, private_key);

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

// Create new account
export const createNewAccount = async () => {
  // Generate public and private key pair
  const privateKey = stark.randomAddress();
  console.log("New ArgentX account:\nprivateKey=", privateKey);

  const starkKeyPub = ec.starkCurve.getStarkKey(privateKey);
  console.log("publicKey=", starkKeyPub);

  // Calculate future address of the ArgentX account
  const axSigner = new CairoCustomEnum({ Starknet: { pubkey: starkKeyPub } });
  const axGuardian = new CairoOption<unknown>(CairoOptionVariant.None);
  const AXConstructorCallData = CallData.compile({
    owner: axSigner,
    guardian: axGuardian,
  });

  const contractAddress = hash.calculateContractAddressFromHash(
    starkKeyPub,
    argentXaccountClassHash,
    AXConstructorCallData,
    0
  );
  console.log("Precalculated account address=", contractAddress);

  const account = new Account(rpc, contractAddress, privateKey);

  try {
    await transferEth(account.address, "10000000000000000");
    console.log("✅ ETH transferred");
  } catch (error) {
    console.error("Error transferring ETH:", error);
  }

  try {
    const { transaction_hash, contract_address } = await account.deployAccount({
      classHash: argentXaccountClassHash,
      constructorCalldata: AXConstructorCallData,
      addressSalt: starkKeyPub,
    });

    await rpc.waitForTransaction(transaction_hash);
    console.log(
      "✅ New ArgentX account created.\n   address =",
      contract_address
    );

    await transferAccount(
      parseInt(process.env.EVENT_DATA_1 || "182"),
      contract_address
    );
    console.log(
      "✅ Account transferred to ",
      contract_address,
      parseInt(process.env.EVENT_DATA_1 || "182")
    );

    return account;
  } catch (error) {
    console.error("Error deploying account:", error);
    throw error;
  }
};

// Transfer ETH
export const transferEth = async (to: string, amount: string) => {
  const moveCall: Call = {
    contractAddress:
      "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
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
