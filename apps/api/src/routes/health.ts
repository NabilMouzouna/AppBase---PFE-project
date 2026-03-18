import type { FastifyInstance } from "fastify";

const healthRouteSchema = {
  tags: ["system"],
  summary: "Health check",
  description: "Returns the liveness status of the current AppBase API instance.",
  response: {
    200: {
      type: "object",
      properties: {
        status: { type: "string", const: "ok" },
      },
      required: ["status"],
    },
  },
} as const;

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get(
    "/health",
    {
      schema: healthRouteSchema,
    },
    async () => ({ status: "ok" }),
  );
}
