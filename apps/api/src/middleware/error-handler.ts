import type { FastifyError, FastifyInstance } from "fastify";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error }, "Unhandled request error");

    const statusCode =
      typeof error.statusCode === "number" && error.statusCode >= 400
        ? error.statusCode
        : 500;

    reply.status(statusCode).send({
      error: {
        code: error.code ?? "INTERNAL_SERVER_ERROR",
        message: statusCode >= 500 ? "Internal server error" : error.message,
      },
    });
  });
}
