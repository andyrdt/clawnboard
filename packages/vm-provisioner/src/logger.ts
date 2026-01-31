/**
 * Structured logging for VM provisioner operations.
 *
 * Provides consistent log formatting with context (VM ID, operation, etc.)
 * for debugging and monitoring.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  vmId?: string;
  vmName?: string;
  operation?: string;
  region?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
  };
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
}

/**
 * Creates a structured logger that outputs JSON logs.
 *
 * @param options - Logger configuration
 * @returns Logger instance
 */
export function createLogger(options?: {
  level?: LogLevel;
  prefix?: string;
}): Logger {
  const minLevel = options?.level || "info";
  const prefix = options?.prefix || "vm-provisioner";

  const levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  function shouldLog(level: LogLevel): boolean {
    return levels[level] >= levels[minLevel];
  }

  function formatEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: `[${prefix}] ${message}`,
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  function log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): void {
    if (!shouldLog(level)) return;

    const entry = formatEntry(level, message, context, error);
    const output = JSON.stringify(entry);

    switch (level) {
      case "debug":
      case "info":
        console.log(output);
        break;
      case "warn":
        console.warn(output);
        break;
      case "error":
        console.error(output);
        break;
    }
  }

  return {
    debug: (message, context) => log("debug", message, context),
    info: (message, context) => log("info", message, context),
    warn: (message, context) => log("warn", message, context),
    error: (message, error, context) => log("error", message, context, error),
  };
}

/**
 * Default logger instance for convenience.
 */
export const defaultLogger = createLogger();
