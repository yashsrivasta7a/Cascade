// =============================================================================
// CENTRALIZED LOGGER
// Provides leveled logging with environment-based filtering
// =============================================================================

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

// Log level priority (lower = more verbose)
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Get minimum log level from environment
// In production, default to "info" to suppress debug logs
// In development, default to "debug" for full visibility
function getMinLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

const MIN_LOG_LEVEL = getMinLogLevel();

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL];
}

function formatMessage(prefix: string, message: string, context?: LogContext): string {
  if (context && Object.keys(context).length > 0) {
    return `[${prefix}] ${message} ${JSON.stringify(context)}`;
  }
  return `[${prefix}] ${message}`;
}

/**
 * Create a logger instance with a specific prefix
 * @param prefix - The prefix to use for all log messages (e.g., "NodeCache", "API")
 */
export function createLogger(prefix: string) {
  return {
    debug(message: string, context?: LogContext): void {
      if (shouldLog("debug")) {
        console.log(formatMessage(prefix, message, context));
      }
    },

    info(message: string, context?: LogContext): void {
      if (shouldLog("info")) {
        console.log(formatMessage(prefix, message, context));
      }
    },

    warn(message: string, context?: LogContext): void {
      if (shouldLog("warn")) {
        console.warn(formatMessage(prefix, message, context));
      }
    },

    error(message: string, error?: unknown, context?: LogContext): void {
      if (shouldLog("error")) {
        const errorInfo = error instanceof Error 
          ? { errorMessage: error.message, stack: error.stack }
          : { error };
        console.error(formatMessage(prefix, message, { ...context, ...errorInfo }));
      }
    },
  };
}

// Default logger for general use
export const logger = createLogger("App");

// Pre-configured loggers for common modules
export const apiLogger = createLogger("API");
export const cacheLogger = createLogger("Cache");
export const workflowLogger = createLogger("Workflow");
export const nodeLogger = createLogger("Node");
export const authLogger = createLogger("Auth");
export const creditsLogger = createLogger("Credits");

export default logger;
