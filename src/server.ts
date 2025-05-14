import type { AnyAgent } from "@daydreamsai/core";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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
      if (req.method === "OPTIONS") {
        return new Response("", {
          status: 204,
          headers: corsHeaders,
        });
      }

      return new Response(null);
    },
    routes: {
      "/workingMemory/:id": {
        GET: async (req) => {
          const workingMemory = await agent.getWorkingMemory(req.params.id);
          return Response.json(workingMemory, {
            headers: {
              ...corsHeaders,
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
              ...corsHeaders,
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
                clearInterval(pingTimer);

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
                clearInterval(pingTimer);
                console.log("closed");
                controller.close();
                unsubscribe?.();
              });
            },
            cancel() {
              console.log("Client disconnected from event stream");
              unsubscribe?.();
              clearInterval(pingTimer);
            },
          });

          return new Response(stream, {
            headers: {
              ...corsHeaders,
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
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
              ...corsHeaders,
            },
          });
        },
      },
    },
  });
}
