import type { FastifyError, FastifyInstance } from "fastify";

function formatValidationMessage(error: FastifyError): string {
  const validation = (error as FastifyError & { validation?: Array<{ message?: string }> }).validation;
  if (Array.isArray(validation) && validation.length > 0) {
    return validation.map((v) => v.message ?? "").filter(Boolean).join("; ");
  }
  return error.message ?? "Validation failed";
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error }, "Unhandled request error");

    const statusCode =
      typeof error.statusCode === "number" && error.statusCode >= 400
        ? error.statusCode
        : 500;

    const isValidation = error.code === "FST_ERR_VALIDATION";
    const code = isValidation ? "VALIDATION_ERROR" : (error.code ?? "INTERNAL_SERVER_ERROR");
    const message =
      statusCode >= 500 ? "Internal server error" : isValidation ? formatValidationMessage(error) : error.message;

    reply.status(statusCode).send({
      success: false,
      error: { code, message },
    });
  });
}
