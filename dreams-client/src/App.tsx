import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
} from "@tanstack/react-query";
import { fetchAgentsWithTroops, deployManager } from "@/services/api";
import type { AgentWithTroops } from "@/services/api";
import { useState } from "react";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { generateName } from "@/services/generate_persona";

const queryClient = new QueryClient();

function AgentsTable() {
  const { data, isLoading, isError, error } = useQuery<AgentWithTroops[]>({
    queryKey: ["agents-with-troops"],
    queryFn: fetchAgentsWithTroops,
  });

  // State to track deploy status per agent
  const [deployingId, setDeployingId] = useState<string | number | null>(null);
  const [deployResult, setDeployResult] = useState<
    Record<string | number, string>
  >({});

  const deployMutation = useMutation({
    mutationFn: (explorerId: string) => deployManager(explorerId),
    onMutate: (explorerId) => {
      setDeployingId(explorerId);
      setDeployResult((prev) => ({ ...prev, [explorerId]: "" }));
    },
    onSuccess: (data, explorerId) => {
      setDeployResult((prev) => ({ ...prev, [explorerId]: "success" }));
      setDeployingId(null);
    },
    onError: (err, explorerId) => {
      setDeployResult((prev) => ({
        ...prev,
        [explorerId]: (err as Error).message,
      }));
      setDeployingId(null);
    },
  });

  return (
    <div>
      <Table className="w-full">
        <TableCaption>
          Agents with {">"}0 troops, coordinates, and category.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Agent ID</TableHead>
            <TableHead>Troop Type</TableHead>
            <TableHead>Created Troop Tier</TableHead>
            <TableHead>Current Troop Tier</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Troop Count</TableHead>
            <TableHead>X</TableHead>
            <TableHead>Y</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead>Troops Updated At</TableHead>
            <TableHead>Deploy</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center">
                Loading...
              </TableCell>
            </TableRow>
          ) : isError ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center">
                Error: {(error as Error).message}
              </TableCell>
            </TableRow>
          ) : data && data.length > 0 ? (
            data.map((agent) => {
              const isRowDeploying = deployingId === agent.agent_id;
              const deployMsg = deployResult[agent.agent_id] || "";
              return (
                <TableRow key={agent.agent_id}>
                  <TableCell>{agent.agent_id}</TableCell>
                  <TableCell>{agent.troop_type}</TableCell>
                  <TableCell>{agent.created_troop_tier}</TableCell>
                  <TableCell>{agent.current_troop_tier}</TableCell>
                  <TableCell>{agent.category}</TableCell>
                  <TableCell>
                    {Number(agent.troop_count / 1000000000).toLocaleString()}
                  </TableCell>
                  <TableCell>{agent.coord_x}</TableCell>
                  <TableCell>{agent.coord_y}</TableCell>
                  <TableCell>{agent.created_ts}</TableCell>
                  <TableCell>{agent.troops_ts}</TableCell>
                  <TableCell>
                    <button
                      onClick={() =>
                        deployMutation.mutate(String(agent.agent_id))
                      }
                      disabled={isRowDeploying}
                      className="px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
                    >
                      {isRowDeploying ? "Deploying..." : "Deploy"}
                    </button>
                    {deployMsg === "success" && (
                      <div className="text-green-600 text-xs mt-1">Success</div>
                    )}
                    {deployMsg && deployMsg !== "success" && (
                      <div className="text-red-600 text-xs mt-1">
                        {deployMsg}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={11} className="text-center">
                No data found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AgentsTable />
    </QueryClientProvider>
  );
}

export default App;
