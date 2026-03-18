import type { FastifyInstance } from "fastify";

export function registerNotFoundHandler(app: FastifyInstance) {
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: `Route ${request.method} ${request.url} not found`,
      },
    });
  });
}
