import type { TroopTier, TroopType } from "../contexts/utils/agent_gen";

const API_BASE_URL = `${process.env.TORII_URL || ""}/sql`;

const QUERIES = {
  EXPLORER_TROOPS: `
      SELECT
          explorer_id,
          "troops.category"        AS troop_category,
          "troops.tier"            AS troop_tier
      FROM
          "s1_eternum-ExplorerTroops"
      WHERE
          explorer_id = {explorerId}
      ORDER BY
          internal_created_at DESC;
  `,
};

// Placeholder type for TokenTransfer
interface ExplorerTroops {
  explorer_id: number;
  troop_category: TroopType;
  troop_tier: TroopTier;
}

export async function fetchExplorerTroops(
  explorerId: number
): Promise<ExplorerTroops> {
  // Construct the query by replacing placeholders
  const query = QUERIES.EXPLORER_TROOPS.replace(
    "{explorerId}",
    explorerId.toString()
  );

  const url = `${API_BASE_URL}?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch token transfers: ${response.statusText}`);
  }

  return (await response.json())[0];
}
