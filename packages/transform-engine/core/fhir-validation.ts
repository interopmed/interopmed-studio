import { resourceProfile, FHIR_R4_PATIENT_PROFILE } from "../fhir/profiles";
import { isJsonObject, readPath } from "./json-path";
import { createOperationOutcome } from "./operation-outcome";
import type {
  FhirProfileValidationResult,
  JsonObject,
  JsonValue,
  SupportedFhirResourceType,
  TransformIssue,
} from "./types";

export function validateFhirR4PatientProfile(
  resource: JsonObject,
): FhirProfileValidationResult {
  const genericValidation = validateGeneratedFhirR4Profile("Patient", resource);
  const issues: TransformIssue[] = [...genericValidation.issues];

  if (
    resource.birthDate !== undefined &&
    (typeof resource.birthDate !== "string" || !isFhirDate(resource.birthDate))
  ) {
    issues.push({
      ruleId: "fhir-birthDate",
      severity: "error",
      message: "FHIR Patient.birthDate must be a FHIR date string.",
    });
  }

  if (
    resource.gender !== undefined &&
    !["male", "female", "other", "unknown"].includes(String(resource.gender))
  ) {
    issues.push({
      ruleId: "fhir-gender",
      severity: "error",
      message:
        "FHIR Patient.gender must be one of male, female, other, or unknown.",
    });
  }

  if (resource.identifier !== undefined && !isIdentifierArray(resource.identifier)) {
    issues.push({
      ruleId: "fhir-identifier",
      severity: "error",
      message: "FHIR Patient.identifier must be an array of Identifier objects.",
    });
  }

  if (Array.isArray(resource.identifier)) {
    resource.identifier.forEach((identifier, index) => {
      if (!isJsonObject(identifier)) {
        return;
      }

      if (
        identifier.system !== undefined &&
        (typeof identifier.system !== "string" ||
          !isFhirUri(identifier.system))
      ) {
        issues.push({
          ruleId: `fhir-identifier-${index}-system`,
          severity: "error",
          message:
            "FHIR Patient.identifier.system must be a uri when present.",
        });
      }

      if (identifier.value === "") {
        issues.push({
          ruleId: `fhir-identifier-${index}-value`,
          severity: "warning",
          message: "FHIR Patient.identifier.value should not be empty.",
        });
      }
    });
  }

  if (resource.name !== undefined && !isHumanNameArray(resource.name)) {
    issues.push({
      ruleId: "fhir-name",
      severity: "error",
      message: "FHIR Patient.name must be an array of HumanName objects.",
    });
  }

  if (Array.isArray(resource.name)) {
    resource.name.forEach((name, index) => {
      if (!isJsonObject(name)) {
        return;
      }

      if (name.use !== undefined && !isHumanNameUse(name.use)) {
        issues.push({
          ruleId: `fhir-name-${index}-use`,
          severity: "error",
          message:
            "FHIR Patient.name.use must be one of usual, official, temp, nickname, anonymous, old, or maiden.",
        });
      }
    });
  }

  if (resource.identifier === undefined && resource.name === undefined) {
    issues.push({
      ruleId: "fhir-minimum-data",
      severity: "warning",
      message:
        "FHIR Patient should include identifying data such as identifier or name.",
    });
  }

  return createGeneratedProfileValidation(FHIR_R4_PATIENT_PROFILE, issues);
}

export function validateGeneratedFhirR4Profile(
  resourceType: SupportedFhirResourceType,
  resource: JsonObject,
): FhirProfileValidationResult {
  const issues: TransformIssue[] = [];
  const profileUrl = resourceProfile(resourceType);

  if (resource.resourceType !== resourceType) {
    issues.push({
      ruleId: "fhir-resourceType",
      severity: "error",
      message: `FHIR ${resourceType} must include resourceType: "${resourceType}".`,
    });
  }

  if (!hasFhirProfile(resource, profileUrl)) {
    issues.push({
      ruleId: "fhir-meta-profile",
      severity: "warning",
      message: `FHIR ${resourceType} should declare meta.profile ${profileUrl}.`,
    });
  }

  if (resource.id !== undefined && typeof resource.id !== "string") {
    issues.push({
      ruleId: "fhir-id",
      severity: "error",
      message: "FHIR id must be a string when present.",
    });
  }

  validateResourceSpecificMinimums(resourceType, resource, issues);

  return createGeneratedProfileValidation(profileUrl, issues);
}

export function createGeneratedProfileValidation(
  profileUrl: string,
  issues: readonly TransformIssue[],
): FhirProfileValidationResult {
  return {
    profileUrl,
    validator: "generated-profile",
    valid: issues.every((issue) => issue.severity !== "error"),
    issues,
    operationOutcome: createOperationOutcome(issues),
  };
}

function hasFhirProfile(resource: JsonObject, profileUrl: string): boolean {
  const meta = resource.meta;

  if (!isJsonObject(meta) || !Array.isArray(meta.profile)) {
    return false;
  }

  return meta.profile.includes(profileUrl);
}

function validateResourceSpecificMinimums(
  resourceType: SupportedFhirResourceType,
  resource: JsonObject,
  issues: TransformIssue[],
): void {
  const requiredPaths: Partial<Record<SupportedFhirResourceType, readonly string[]>> = {
    Patient: [],
    Observation: ["$.status", "$.code", "$.subject"],
    Encounter: ["$.status", "$.class", "$.subject"],
    Condition: ["$.code", "$.subject"],
    Procedure: ["$.status", "$.code", "$.subject"],
    MedicationRequest: ["$.status", "$.intent", "$.medicationCodeableConcept", "$.subject"],
    MedicationStatement: ["$.status", "$.medicationCodeableConcept", "$.subject"],
    DiagnosticReport: ["$.status", "$.code", "$.subject"],
    DocumentReference: ["$.status", "$.type", "$.content"],
    Organization: ["$.name"],
    Practitioner: ["$.identifier", "$.name"],
    PractitionerRole: ["$.practitioner"],
    RelatedPerson: ["$.patient", "$.name"],
    AllergyIntolerance: ["$.code", "$.patient"],
    Immunization: ["$.status", "$.vaccineCode", "$.patient"],
    ServiceRequest: ["$.status", "$.intent", "$.code", "$.subject"],
  };

  (requiredPaths[resourceType] ?? []).forEach((path) => {
    if (readPath(resource, path) === undefined) {
      issues.push({
        ruleId: `fhir-${resourceType}-${path}`,
        severity: "error",
        message: `FHIR ${resourceType} generated profile requires ${path}.`,
      });
    }
  });
}

function isIdentifierArray(value: JsonValue): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isJsonObject(item) &&
        (item.system === undefined || typeof item.system === "string") &&
        (item.use === undefined || isIdentifierUse(item.use)) &&
        (item.value === undefined || typeof item.value === "string"),
    )
  );
}

function isHumanNameArray(value: JsonValue): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isJsonObject(item) &&
        (item.use === undefined || isHumanNameUse(item.use)) &&
        (item.family === undefined || typeof item.family === "string") &&
        (item.given === undefined ||
          (Array.isArray(item.given) &&
            item.given.every((given) => typeof given === "string"))),
    )
  );
}

function isIdentifierUse(value: JsonValue): boolean {
  return (
    typeof value === "string" &&
    ["usual", "official", "temp", "secondary", "old"].includes(value)
  );
}

function isHumanNameUse(value: JsonValue): boolean {
  return (
    typeof value === "string" &&
    [
      "usual",
      "official",
      "temp",
      "nickname",
      "anonymous",
      "old",
      "maiden",
    ].includes(value)
  );
}

function isFhirUri(value: string): boolean {
  return /^(urn:|https?:\/\/)[^\s]+$/.test(value);
}

function isFhirDate(value: string): boolean {
  if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(value)) {
    return false;
  }

  if (/^\d{4}$/.test(value)) {
    return true;
  }

  if (/^\d{4}-\d{2}$/.test(value)) {
    const month = Number(value.slice(5, 7));
    return month >= 1 && month <= 12;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
