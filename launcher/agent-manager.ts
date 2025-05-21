#!/usr/bin/env bun
import inquirer from "inquirer";
import { fetchAgentsWithTroops, deployManager } from "./launch-agents";
import type { AgentWithTroops } from "./launch-agents";

async function main() {
  try {
    console.log("Fetching agents with troops...");
    const agents: AgentWithTroops[] = await fetchAgentsWithTroops();
    if (!agents.length) {
      console.log("No agents with troops found.");
      return;
    }

    // Format agents for display
    const choices = agents.map((agent) => ({
      name: `ID: ${agent.agent_id} | Troops: ${agent.troop_count} | Cat: ${agent.category} | Coords: (${agent.coord_x},${agent.coord_y}) | Tier: ${agent.current_troop_tier}`,
      value: agent.agent_id,
    }));

    const { selectedAgents } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selectedAgents",
        message: "Select agents to deploy:",
        choices,
        pageSize: 20,
      },
    ]);

    if (!selectedAgents.length) {
      console.log("No agents selected.");
      return;
    }

    for (const agentId of selectedAgents) {
      process.stdout.write(`Deploying agent ${agentId}... `);
      try {
        const result = await deployManager(agentId);
        console.log("Success:", result.status || JSON.stringify(result));
      } catch (err: any) {
        console.error("Failed:", err.message);
      }
      // Add a 30 second delay between deployments
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }
    console.log("Done.");
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

main();
