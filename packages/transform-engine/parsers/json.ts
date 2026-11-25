import { isJsonObject } from "../core/json-path";
import type { JsonObject, ParseResult } from "../core/types";

export function parseJsonPayload(rawPayload: string): ParseResult {
  try {
    const parsed: unknown = JSON.parse(rawPayload);

    if (!isJsonObject(parsed)) {
      return {
        payload: null,
        issues: [
          {
            ruleId: "parser",
            severity: "error",
            message: "JSON input must be an object at the root.",
          },
        ],
      };
    }

    return { payload: parsed as JsonObject, issues: [] };
  } catch (error) {
    return {
      payload: null,
      issues: [
        {
          ruleId: "parser",
          severity: "error",
          message: error instanceof Error ? error.message : "Invalid JSON input.",
        },
      ],
    };
  }
}
