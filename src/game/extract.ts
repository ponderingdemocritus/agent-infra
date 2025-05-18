import testnetAbi from "./abi.json";
import mainnetAbi from "./mainnet-abi.json";

let abi: any = {};

if (process.env.NETWORK === "mainnet") {
  abi = mainnetAbi;
} else {
  abi = testnetAbi;
}

export const worldName = abi.world.name;
export const worldAddress = abi.world.address;
export const worldClassHash = abi.world.class_hash;

export const contracts = abi.contracts.map((contract: any) => ({
  name: contract.tag,
  address: contract.address,
  classHash: contract.class_hash,
  selector: contract.selector,
  systems: contract.systems || [],
}));

export function getContract(name: string) {
  return contracts.find((contract: any) => contract.name === name)?.address;
}

export function getContractByAddress(address: string) {
  return contracts.find((contract: any) => contract.address === address);
}

export const troop_battle_systems = getContract(
  "s1_eternum-troop_battle_systems"
);

export const troop_management_systems = getContract(
  "s1_eternum-troop_management_systems"
);
export const troop_movement_systems = getContract(
  "s1_eternum-troop_movement_systems"
);
export const troop_movement_util_systems = getContract(
  "s1_eternum-troop_movement_util_systems"
);

export const troop_raid_systems = getContract("s1_eternum-troop_raid_systems");

// ownership_systems

export const ownership_systems = getContract("s1_eternum-ownership_systems");

export const ownership_util_systems = getContract(
  "s1_eternum-ownership_util_systems"
);
