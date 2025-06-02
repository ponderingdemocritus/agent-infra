const API_BASE_URL =
  "https://api.cartridge.gg/x/eternum-game-mainnet-28/torii/sql";

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

// Predefined list of special agents to deploy
const SPECIAL_AGENTS = [
  9673, 14258, 12595, 12256, 13999, 15317, 15245, 15981, 17014, 18838, 16723,
  15428, 18341, 15212, 17363, 15787, 16644, 22962, 20603, 23520, 21594, 22568,
  22001, 22646, 23439, 21567, 23354, 27274, 25773, 24782, 27456, 24898, 25396,
  25787, 28123, 29727, 28057, 29312, 30410, 30356, 30771, 34005, 33335, 33354,
  34004, 32131, 33095, 32138, 33782, 32313, 31280, 32446, 34302, 36615, 34200,
  34347, 37595, 39532, 39269, 40376, 43465, 44030, 45886, 45933, 45345, 46021,
  45755, 46595, 47039, 49543, 48524, 49146, 51172, 53114, 53987, 53723, 52150,
  52189, 56107, 56105, 55619, 56260, 56608, 60224, 58562, 59952, 60211, 59284,
  59357, 59719, 62015, 61716, 60914, 61879, 62351, 62046, 62098, 61212, 62045,
  64622, 63795, 64552, 62740, 63409, 62745, 64726, 62952, 64452, 66544, 66533,
  66560, 66073, 66530, 66557, 66548, 66556, 64989, 66552, 65044, 66550, 66553,
  66529, 65073, 64960, 66535, 66179, 66546, 65121, 65628, 66559, 65246, 66613,
  66808, 67841, 67905, 68185, 68396, 68397, 68585, 68668, 68669, 68676, 68850,
  69165,
];

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
        Accept: "application/json",
      },
      body: JSON.stringify({ explorerId: String(explorerId) }),
    }
  );

  console.log(response);
  if (!response.ok) {
    throw new Error(`Failed to deploy: ${response.statusText}`);
  }
  return await response.json();
}

/**
 * Deploy all special agents from the predefined list
 */
export async function deployAllSpecialAgents(): Promise<void> {
  console.log(
    `Starting deployment of ${SPECIAL_AGENTS.length} special agents...`
  );

  const results = [];

  for (let i = 0; i < SPECIAL_AGENTS.length; i++) {
    const agentId = SPECIAL_AGENTS[i];
    console.log(
      `Deploying agent ${i + 1}/${SPECIAL_AGENTS.length}: ${agentId}`
    );

    try {
      const result = await deployManager(String(agentId));
      results.push({ agentId, success: true, result });
      console.log(`✅ Successfully deployed agent ${agentId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      results.push({ agentId, success: false, error: errorMessage });
      console.error(`❌ Failed to deploy agent ${agentId}:`, errorMessage);
    }

    // Add a small delay between requests to avoid overwhelming the server
    if (i < SPECIAL_AGENTS.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Summary
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`\n🎯 Deployment Summary:`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${results.length}`);

  if (failed > 0) {
    console.log(`\n❌ Failed agents:`);
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  - Agent ${r.agentId}: ${r.error}`);
      });
  }
}

/**
 * Main function to execute the deployment
 */
export async function main(): Promise<void> {
  try {
    await deployAllSpecialAgents();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Fatal error during deployment:", errorMessage);
    process.exit(1);
  }
}

// If this file is run directly, execute the main function
if (import.meta.main) {
  main();
}
