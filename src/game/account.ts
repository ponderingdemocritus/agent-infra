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
const rpc_url = process.env.RPC_URL!;

const account_address = process.env.MASTER_PUBLIC_KEY ?? "";
const private_key = process.env.MASTER_PRIVATE_KEY ?? "";

const argentXaccountClassHash =
  "0x036078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f";

// Max retry attempts and delay between retries
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

// Initialize RPC provider
export const rpc = new RpcProvider({
  nodeUrl: rpc_url,
});

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
  const masterAccount = new Account(
    rpc,
    account_address,
    private_key,
    undefined,
    constants.TRANSACTION_VERSION.V3
  );

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
    await transferEth(masterAccount, account.address, "20000000000000000000");
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

    await transferAccount(masterAccount, explorer_id, contract_address);
    console.log("✅ Account transferred to ", contract_address, explorer_id);

    return { account, publicKey, privateKey };
  } catch (error) {
    console.error("Error deploying account:", error);
    throw error;
  }
};

// Transfer ETH
export const transferEth = async (
  masterAccount: Account,
  to: string,
  amount: string
) => {
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
  masterAccount: Account,
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
