import {
  fhirR4ResourceTypes,
  isFhirR4ResourceType,
  type FhirR4ResourceType,
} from "../fhir/fhir-r4-resources";
import { generatePipelineCode } from "../generation/codegen";
import {
  generateIntegrationBundle,
  generateIntegrationPackage,
} from "../exports/package-export";
import { parseHl7v2Payload } from "../parsers/hl7-v2";
import { FHIR_R4_PATIENT_PROFILE } from "../fhir/profiles";
import {
  createBaseResource,
  defaultRulesFor,
  getResourceModule,
  hl7PatientRules,
  jsonPatientRules,
  patientNameRules,
  resourceModules,
} from "../fhir/resource-modules";
import { parseJsonPayload } from "../parsers/json";
import {
  createGeneratedProfileValidation,
  validateFhirR4PatientProfile,
  validateGeneratedFhirR4Profile,
} from "./fhir-validation";
import {
  cloneJsonObject,
  isJsonObject,
  readPath,
  writePath,
} from "./json-path";
import { createOperationOutcome } from "./operation-outcome";
import { applyTransform } from "./transforms";
import type {
  CodegenTarget,
  ExternalFhirValidatorAdapter,
  FhirProfileValidationResult,
  FhirVersion,
  IntegrationBundle,
  IntegrationBundleRequest,
  IntegrationPackage,
  IntegrationPackageRequest,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  MappingRule,
  ParseResult,
  PatientPipelineResult,
  PipelineCodeRequest,
  ResourceModule,
  SourceFormat,
  SupportedFhirResourceType,
  TransformIssue,
  TransformName,
  TransformResult,
} from "./types";

export { fhirR4ResourceTypes, isFhirR4ResourceType, type FhirR4ResourceType };
export {
  getResourceModule,
  hl7PatientRules,
  jsonPatientRules,
  patientNameRules,
  resourceModules,
};
export type {
  CodegenTarget,
  ExternalFhirValidatorAdapter,
  FhirProfileValidationResult,
  FhirVersion,
  IntegrationBundle,
  IntegrationBundleRequest,
  IntegrationPackage,
  IntegrationPackageFile,
  IntegrationPackageRequest,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  MappingRule,
  ParseResult,
  PatientPipelineResult,
  PipelineCodeRequest,
  ResourceModule,
  SourceFormat,
  SupportedFhirResourceType,
  TransformIssue,
  TransformName,
  TransformResult,
} from "./types";

export class InteropEngine {
  private static runPipeline(
    rawPayload: string,
    sourceFormat: SourceFormat,
    transformPayload: (payload: JsonObject) => TransformResult,
  ): PatientPipelineResult {
    const startedAt = Date.now();
    const parsed = this.parseLegacyPayload(rawPayload, sourceFormat);

    if (parsed.payload === null) {
      return {
        normalizedSource: null,
        output: null,
        operationOutcome: createOperationOutcome(parsed.issues),
        profileValidation: null,
        sourceFormat,
        processedRuleCount: 0,
        appliedRuleCount: 0,
        fhirCompatible: false,
        execution: {
          mode: "stateless-in-memory",
          persistedPhi: false,
          externalTelemetry: false,
          elapsedMs: Date.now() - startedAt,
        },
      };
    }

    const transformed = transformPayload(parsed.payload);
    const issues = [
      ...parsed.issues,
      ...transformed.issues,
      ...transformed.fhirIssues,
    ];

    return {
      normalizedSource: parsed.payload,
      output: transformed.output,
      operationOutcome: createOperationOutcome(issues),
      profileValidation: transformed.profileValidation,
      sourceFormat,
      processedRuleCount: transformed.processedRuleCount,
      appliedRuleCount: transformed.appliedRuleCount,
      fhirCompatible: transformed.fhirCompatible,
      execution: {
        mode: "stateless-in-memory",
        persistedPhi: false,
        externalTelemetry: false,
        elapsedMs: Date.now() - startedAt,
      },
    };
  }

  public static runResourcePipeline(
    rawPayload: string,
    sourceFormat: SourceFormat,
    resourceType: SupportedFhirResourceType,
    rules: readonly MappingRule[] = defaultRulesFor(resourceType, sourceFormat),
  ): PatientPipelineResult {
    return this.runPipeline(rawPayload, sourceFormat, (payload) =>
      this.transformToFhirResource(resourceType, payload, rules),
    );
  }

  public static runPatientPipeline(
    rawPayload: string,
    sourceFormat: SourceFormat,
    rules: readonly MappingRule[] = sourceFormat === "json"
      ? jsonPatientRules
      : hl7PatientRules,
  ): PatientPipelineResult {
    return this.runPipeline(rawPayload, sourceFormat, (payload) =>
      this.transformToFhirPatient(payload, rules),
    );
  }

  public static parseLegacyPayload(
    rawPayload: string,
    sourceFormat: SourceFormat,
  ): ParseResult {
    if (sourceFormat === "json") {
      return parseJsonPayload(rawPayload);
    }

    return parseHl7v2Payload(rawPayload);
  }

  public static transformToFhirPatient(
    payload: unknown,
    rules: readonly MappingRule[] = jsonPatientRules,
  ): TransformResult {
    return this.transformToFhirResource("Patient", payload, rules);
  }

  public static transformToFhirResource(
    resourceType: SupportedFhirResourceType,
    payload: unknown,
    rules: readonly MappingRule[] = defaultRulesFor(resourceType, "json"),
  ): TransformResult {
    return this.translate(
      payload,
      rules,
      createBaseResource(resourceType),
      resourceType,
    );
  }

  public static translate(
    payload: unknown,
    rules: readonly MappingRule[],
    baseOutput: JsonObject = {},
    resourceType: SupportedFhirResourceType = "Patient",
  ): TransformResult {
    const output = cloneJsonObject(baseOutput);
    const issues: TransformIssue[] = [];
    let appliedRuleCount = 0;

    if (!isJsonObject(payload)) {
      return {
        output,
        issues: [
          {
            ruleId: "payload",
            severity: "error",
            message: "Input payload must be a JSON object.",
          },
        ],
        fhirIssues: [],
        profileValidation: createGeneratedProfileValidation(
          FHIR_R4_PATIENT_PROFILE,
          [
            {
              ruleId: "payload",
              severity: "error",
              message: "Input payload must be a JSON object.",
            },
          ],
        ),
        operationOutcome: createOperationOutcome([
          {
            ruleId: "payload",
            severity: "error",
            message: "Input payload must be a JSON object.",
          },
        ]),
        fhirCompatible: false,
        processedRuleCount: 0,
        appliedRuleCount,
      };
    }

    for (const rule of rules) {
      const rawValue = readPath(payload, rule.sourcePath);
      const value = rawValue === undefined ? rule.fallback : rawValue;

      if (value === undefined) {
        if (rule.required === true) {
          issues.push({
            ruleId: rule.id,
            severity: "error",
            message: `Required source path ${rule.sourcePath} was not found.`,
          });
        } else {
          issues.push({
            ruleId: rule.id,
            severity: "warning",
            message: `Optional source path ${rule.sourcePath} was not found.`,
          });
        }

        continue;
      }

      const transformed = applyTransform(value, rule.transform ?? "none", rule.id, issues);
      if (transformed === undefined) {
        continue;
      }

      writePath(output, rule.targetPath, transformed);
      appliedRuleCount += 1;
    }

    const profileValidation = validateGeneratedFhirR4Profile(resourceType, output);
    const fhirIssues = profileValidation.issues;

    return {
      output,
      issues,
      fhirIssues,
      profileValidation,
      operationOutcome: createOperationOutcome([...issues, ...fhirIssues]),
      fhirCompatible:
        issues.every((issue) => issue.severity !== "error") &&
        fhirIssues.every((issue) => issue.severity !== "error"),
      processedRuleCount: rules.length,
      appliedRuleCount,
    };
  }

  public static generatePipelineCode(request: PipelineCodeRequest): string {
    return generatePipelineCode(request);
  }

  public static validateFhirR4PatientProfile(
    resource: JsonObject,
  ): FhirProfileValidationResult {
    return validateFhirR4PatientProfile(resource);
  }

  public static validateGeneratedFhirR4Profile(
    resourceType: SupportedFhirResourceType,
    resource: JsonObject,
  ): FhirProfileValidationResult {
    return validateGeneratedFhirR4Profile(resourceType, resource);
  }

  public static generateIntegrationPackage(
    request: IntegrationPackageRequest,
  ): IntegrationPackage {
    return generateIntegrationPackage(request, this.parseLegacyPayload);
  }

  public static generateIntegrationBundle(
    request: IntegrationBundleRequest,
  ): IntegrationBundle {
    return generateIntegrationBundle(request, this.parseLegacyPayload);
  }
}
