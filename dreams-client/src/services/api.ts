const API_BASE_URL = import.meta.env.VITE_PUBLIC_TORII + "/sql";

// Define SQL queries separately for better maintainability
const QUERIES = {
  AGENTS_WITH_TROOPS: `
    WITH latest_agent AS (
        SELECT
            explorer_id                     AS agent_id,
            troop_type,
            troop_tier,
            troop_amount,
            timestamp                       AS created_ts,
            internal_executed_at,
            ROW_NUMBER() OVER (
                PARTITION BY explorer_id
                ORDER BY internal_executed_at DESC, timestamp DESC
            ) AS rn
        FROM \`s1_eternum-AgentCreatedEvent\`
    ),
    latest_troops AS (
        SELECT
            explorer_id,
            \`troops.count\`     AS troop_count,
            \`troops.category\`                   AS category,
            \`troops.tier\`                       AS current_troop_tier,
            \`coord.x\`                           AS coord_x,
            \`coord.y\`                           AS coord_y,
            internal_executed_at                AS troops_ts,
            ROW_NUMBER() OVER (
                PARTITION BY explorer_id
                ORDER BY internal_executed_at DESC
            ) AS rn
        FROM \`s1_eternum-ExplorerTroops\`
    )
    SELECT
        a.agent_id,
        a.troop_type,
        a.troop_tier           AS created_troop_tier,
        t.current_troop_tier,
        t.category,            -- requested category
        t.troop_count,
        t.coord_x,             -- requested coords
        t.coord_y,
        a.created_ts,
        t.troops_ts
    FROM   latest_agent  a
    JOIN   latest_troops t
           ON t.explorer_id = a.agent_id
    WHERE  a.rn = 1
      AND  t.rn = 1
    ORDER  BY a.agent_id;
  `,
};

// Type for the agents with troops result
export interface AgentWithTroops {
  agent_id: number | string;
  troop_type: string;
  created_troop_tier: number | string;
  current_troop_tier: number | string;
  category: string;
  troop_count: number;
  coord_x: number;
  coord_y: number;
  created_ts: string;
  troops_ts: string;
}

/**
 * Fetch agents with >0 troops, including coords & category
 */
export async function fetchAgentsWithTroops(): Promise<AgentWithTroops[]> {
  const url = `${API_BASE_URL}?query=${encodeURIComponent(
    QUERIES.AGENTS_WITH_TROOPS
  )}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch agents with troops: ${response.statusText}`
    );
  }
  return await response.json();
}

/**
 * Call the deploy endpoint with a bearer token from env, passing explorerId in the body
 */
export async function deployManager(explorerId: string): Promise<any> {
  const token = import.meta.env.VITE_PUBLIC_DEPLOY_BEARER_TOKEN;
  if (!token) throw new Error("Missing VITE_PUBLIC_DEPLOY_BEARER_TOKEN in env");
  const response = await fetch(
    "https://manager.eternum.daydreams.cloud/deploy",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ explorerId }),
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to deploy: ${response.statusText}`);
  }
  return await response.json();
}
