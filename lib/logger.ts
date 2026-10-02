/**
 * Structured server logging without customer PII.
 * Ready for optional Sentry wiring via SENTRY_DSN (see SECURITY.md).
 */

type LogLevel = "info" | "warn" | "error";

type LogFields = Record<string, string | number | boolean | null | undefined>;

const SENSITIVE_KEYS =
  /name|phone|address|email|password|token|authorization|cookie|lat|lng|note/i;

function scrub(fields?: LogFields): LogFields | undefined {
  if (!fields) return undefined;
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEYS.test(key)) {
      out[key] = "[redacted]";
    } else {
      out[key] = value;
    }
  }
  return out;
}

function emit(level: LogLevel, message: string, fields?: LogFields) {
  const payload = {
    level,
    message,
    ts: new Date().toISOString(),
    ...scrub(fields),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
};
