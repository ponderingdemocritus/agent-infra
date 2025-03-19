import abi from "./abi.json";

export const worldName = abi.world.name;
export const worldAddress = abi.world.address;
export const worldClassHash = abi.world.class_hash;

export const contracts = abi.contracts.map((contract) => ({
  name: contract.tag,
  address: contract.address,
  classHash: contract.class_hash,
  selector: contract.selector,
  systems: contract.systems || [],
}));

export function getContract(name: string) {
  return contracts.find((contract) => contract.name === name)?.address;
}

export function getContractByAddress(address: string) {
  return contracts.find((contract) => contract.address === address);
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
