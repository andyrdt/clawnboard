import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

export const errorHandler: ErrorHandler = (err, c) => {
  // Avoid logging errors that cause recursive issues
  if (process.env.NODE_ENV !== "test") {
    console.error("Error:", err?.message || err);
  }

  if (err instanceof HTTPException) {
    return c.json(
      {
        success: false,
        error: {
          code: "HTTP_ERROR",
          message: err.message,
        },
      },
      err.status
    );
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: err.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      400
    );
  }

  // Check for Zod-like errors by duck typing
  if (err && typeof err === "object" && "issues" in err && Array.isArray((err as { issues: unknown[] }).issues)) {
    const issues = (err as { issues: Array<{ path: string[]; message: string }> }).issues;
    return c.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: issues.map((issue) => ({
            path: issue.path?.join?.(".") || "",
            message: issue.message,
          })),
        },
      },
      400
    );
  }

  return c.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message:
          process.env.NODE_ENV === "production"
            ? "An internal error occurred"
            : err?.message || "Unknown error",
      },
    },
    500
  );
};
