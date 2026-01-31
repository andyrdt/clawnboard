import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "./logger.js";

describe("logger", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createLogger", () => {
    it("should create a logger with default options", () => {
      const logger = createLogger();

      logger.info("test message");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.level).toBe("info");
      expect(output.message).toContain("test message");
      expect(output.timestamp).toBeDefined();
    });

    it("should include custom prefix in messages", () => {
      const logger = createLogger({ prefix: "my-service" });

      logger.info("hello");

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.message).toBe("[my-service] hello");
    });

    it("should include context when provided", () => {
      const logger = createLogger();

      logger.info("VM started", { vmId: "vm-123", region: "iad" });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.context).toEqual({ vmId: "vm-123", region: "iad" });
    });

    it("should not include context when empty", () => {
      const logger = createLogger();

      logger.info("simple message");

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.context).toBeUndefined();
    });
  });

  describe("log levels", () => {
    it("should log info messages to console.log", () => {
      const logger = createLogger();

      logger.info("info message");

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("should log debug messages to console.log", () => {
      const logger = createLogger({ level: "debug" });

      logger.debug("debug message");

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should log warn messages to console.warn", () => {
      const logger = createLogger();

      logger.warn("warning message");

      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should log error messages to console.error", () => {
      const logger = createLogger();

      logger.error("error message", new Error("test error"));

      expect(consoleErrorSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(output.error.message).toBe("test error");
      expect(output.error.stack).toBeDefined();
    });
  });

  describe("level filtering", () => {
    it("should filter debug messages when level is info", () => {
      const logger = createLogger({ level: "info" });

      logger.debug("should not appear");
      logger.info("should appear");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.message).toContain("should appear");
    });

    it("should filter info messages when level is warn", () => {
      const logger = createLogger({ level: "warn" });

      logger.debug("no");
      logger.info("no");
      logger.warn("yes");
      logger.error("yes");

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it("should only log errors when level is error", () => {
      const logger = createLogger({ level: "error" });

      logger.debug("no");
      logger.info("no");
      logger.warn("no");
      logger.error("yes");

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it("should log everything when level is debug", () => {
      const logger = createLogger({ level: "debug" });

      logger.debug("d");
      logger.info("i");
      logger.warn("w");
      logger.error("e");

      expect(consoleLogSpy).toHaveBeenCalledTimes(2); // debug + info
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("error logging", () => {
    it("should include error details", () => {
      const logger = createLogger();
      const error = new Error("Something went wrong");

      logger.error("Operation failed", error, { operation: "test" });

      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(output.level).toBe("error");
      expect(output.message).toContain("Operation failed");
      expect(output.context).toEqual({ operation: "test" });
      expect(output.error.message).toBe("Something went wrong");
      expect(output.error.stack).toContain("Error: Something went wrong");
    });

    it("should handle error without context", () => {
      const logger = createLogger();

      logger.error("Failed", new Error("oops"));

      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(output.error.message).toBe("oops");
      expect(output.context).toBeUndefined();
    });

    it("should handle logging without error", () => {
      const logger = createLogger();

      logger.error("Something bad");

      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(output.message).toContain("Something bad");
      expect(output.error).toBeUndefined();
    });
  });

  describe("timestamp", () => {
    it("should include ISO timestamp", () => {
      const logger = createLogger();

      logger.info("test");

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });
  });
});
