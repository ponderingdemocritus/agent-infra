import type { AnyAgent } from "@daydreamsai/core";

export function createAgentServer({
  agent,
  port,
}: {
  agent: AnyAgent;
  port?: number;
}) {
  return Bun.serve({
    port,
    fetch(req) {
      // const url = new URL(req.url);

      // Handle preflight OPTIONS requests
      if (req.method === "OPTIONS") {
        const headers = new Headers();
        headers.set("Access-Control-Allow-Origin", "*"); // Or your specific origin
        headers.set(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, DELETE, OPTIONS"
        );
        headers.set(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization"
        );
        // headers.set("Access-Control-Allow-Credentials", "true"); // Uncomment if needed
        // headers.set("Access-Control-Max-Age", "86400"); // Optional: Cache preflight response for 1 day
        return new Response(null, { status: 204, headers });
      }

      return new Response(null);
    },
    routes: {
      "/workingMemory/:id": {
        GET: async (req) => {
          const workingMemory = await agent.getWorkingMemory(req.params.id);
          return Response.json(workingMemory, {
            headers: {
              "Access-Control-Allow-Origin": "*",
            },
          });
        },
      },
      "/state/:id": {
        GET: async (req) => {
          const ctx = await agent.getContextById(req.params.id);
          if (!ctx) return Response.json(null);
          const { context, ...state } = ctx;
          return Response.json(state, {
            headers: {
              "Access-Control-Allow-Origin": "*",
            },
          });
        },
      },
      "/state/:id/subscribe": {
        GET: (req) => {
          let unsubscribe: undefined | (() => void);
          let pingTimer: NodeJS.Timer;
          const contextId = req.params.id;
          const stream = new ReadableStream({
            start(controller) {
              console.log("Client connected to event stream");

              function setPingTimer() {
                pingTimer = setInterval(() => {
                  controller.enqueue(`data: ping\n\n`);
                }, 1000);
              }

              setPingTimer();

              unsubscribe = agent.__subscribeChunk(contextId, (log) => {
                clearInterval(pingTimer);

                controller.enqueue(
                  new TextEncoder().encode(
                    `data: ` + JSON.stringify(log) + "\n\n"
                  )
                );

                setPingTimer();
              });

              req.signal.addEventListener("abort", () => {
                console.log("closed");
                controller.close();
                unsubscribe?.();
                clearInterval(pingTimer);
              });
            },
            cancel() {
              console.log("Client disconnected from event stream");
              unsubscribe?.();
              clearInterval(pingTimer);
            },
          });

          const res = new Response(stream, {
            headers: {
              "Access-Control-Allow-Origin": "*",

              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });

          return res;
        },
      },
      "/send/:id": {
        POST: async (req) => {
          const data: { input: { type: string; data: any } } = await req.json();

          const ctx = await agent.getContextById(req.params.id);
          if (!ctx) throw new Error("no ctx");

          const res = await agent.send({
            context: ctx.context,
            args: ctx.args,
            input: data.input,
          });

          return Response.json(res, {
            headers: {
              "Access-Control-Allow-Origin": "*",
            },
          });
        },
      },
    },
  });
}
