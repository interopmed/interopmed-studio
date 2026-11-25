import type { JsonObject, TransformIssue } from "./types";

export function createOperationOutcome(
  issues: readonly TransformIssue[],
): JsonObject {
  return {
    resourceType: "OperationOutcome",
    issue:
      issues.length === 0
        ? [
            {
              severity: "information",
              code: "informational",
              diagnostics: "No parser, mapping, or FHIR compatibility issues detected.",
            },
          ]
        : issues.map((issue) => ({
            severity: issue.severity === "error" ? "error" : "warning",
            code: issue.severity === "error" ? "processing" : "business-rule",
            diagnostics: issue.message,
            expression: [issue.ruleId],
          })),
  };
}
