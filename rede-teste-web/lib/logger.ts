type LogLevel = "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

function write(level: LogLevel, message: string, fields?: LogFields) {
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function createRequestLogger(requestId: string) {
  const base = { requestId };
  return {
    info: (message: string, fields?: LogFields) =>
      write("info", message, { ...base, ...fields }),
    warn: (message: string, fields?: LogFields) =>
      write("warn", message, { ...base, ...fields }),
    error: (message: string, fields?: LogFields) =>
      write("error", message, { ...base, ...fields }),
  };
}

export const log = {
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};
