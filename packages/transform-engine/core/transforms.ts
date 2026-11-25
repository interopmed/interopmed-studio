import type { JsonValue, TransformIssue, TransformName } from "./types";

export function applyTransform(
  value: JsonValue,
  transform: TransformName,
  ruleId: string,
  issues: TransformIssue[],
): JsonValue | undefined {
  if (transform === "none") {
    return value;
  }

  if (typeof value !== "string") {
    issues.push({
      ruleId,
      severity: "warning",
      message: `Transform ${transform} expected a string and received ${typeof value}.`,
    });
    return value;
  }

  if (transform === "compactDateToIso") {
    return compactDateToIso(value, ruleId, issues);
  }

  if (transform === "fhirAdministrativeGender") {
    return toFhirAdministrativeGender(value, ruleId, issues);
  }

  if (transform === "fhirIdentifierSystem") {
    return toFhirIdentifierSystem(value);
  }

  if (transform === "trim") {
    return value.trim();
  }

  if (transform === "uppercase") {
    return value.trim().toUpperCase();
  }

  return value.trim().toLowerCase();
}

export function compactDateToIso(
  value: string,
  ruleId: string,
  issues: TransformIssue[],
): string {
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }

  issues.push({
    ruleId,
    severity: "warning",
    message: `Date value "${value}" was not converted because it is not YYYYMMDD or YYYY-MM-DD.`,
  });

  return trimmed;
}

function toFhirAdministrativeGender(
  value: string,
  ruleId: string,
  issues: TransformIssue[],
): string {
  const normalized = value.trim().toLowerCase();
  const mapped = {
    f: "female",
    female: "female",
    m: "male",
    male: "male",
    o: "other",
    other: "other",
    u: "unknown",
    unk: "unknown",
    unknown: "unknown",
  }[normalized];

  if (mapped !== undefined) {
    return mapped;
  }

  issues.push({
    ruleId,
    severity: "warning",
    message: `Administrative gender "${value}" is not a FHIR R4 code; using "unknown".`,
  });

  return "unknown";
}

function toFhirIdentifierSystem(value: string): string {
  const trimmed = value.trim();

  if (trimmed.startsWith("urn:") || /^https?:\/\//.test(trimmed)) {
    return trimmed;
  }

  return `urn:interopmed:identifier-system:${trimmed.toLowerCase()}`;
}
