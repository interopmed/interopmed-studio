import type { FhirR4ResourceType } from "../fhir/fhir-r4-resources";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type CodegenTarget = "typescript" | "python" | "node";
export type SourceFormat = "json" | "hl7v2";
export type FhirVersion = "R4" | "R5-preview";
export type SupportedFhirResourceType = FhirR4ResourceType;
export type TransformName =
  | "none"
  | "compactDateToIso"
  | "fhirAdministrativeGender"
  | "fhirIdentifierSystem"
  | "trim"
  | "uppercase"
  | "lowercase";

export interface MappingRule {
  readonly id: string;
  readonly label: string;
  readonly sourcePath: string;
  readonly targetPath: string;
  readonly required?: boolean;
  readonly transform?: TransformName;
  readonly fallback?: JsonValue;
}

export interface TransformIssue {
  readonly ruleId: string;
  readonly message: string;
  readonly severity: "warning" | "error";
}

export interface FhirProfileValidationResult {
  readonly profileUrl: string;
  readonly validator: "generated-profile";
  readonly valid: boolean;
  readonly issues: readonly TransformIssue[];
  readonly operationOutcome: JsonObject;
}

export interface ExternalFhirValidatorAdapter {
  readonly id: string;
  readonly validate: (
    resource: JsonObject,
    profileUrl: string,
  ) => FhirProfileValidationResult | Promise<FhirProfileValidationResult>;
}

export interface TransformResult {
  readonly output: JsonObject;
  readonly issues: readonly TransformIssue[];
  readonly fhirIssues: readonly TransformIssue[];
  readonly profileValidation: FhirProfileValidationResult;
  readonly operationOutcome: JsonObject;
  readonly fhirCompatible: boolean;
  readonly processedRuleCount: number;
  readonly appliedRuleCount: number;
}

export interface PatientPipelineResult {
  readonly normalizedSource: JsonObject | null;
  readonly output: JsonObject | null;
  readonly operationOutcome: JsonObject;
  readonly profileValidation: FhirProfileValidationResult | null;
  readonly sourceFormat: SourceFormat;
  readonly processedRuleCount: number;
  readonly appliedRuleCount: number;
  readonly fhirCompatible: boolean;
  readonly execution: {
    readonly mode: "stateless-in-memory";
    readonly persistedPhi: false;
    readonly externalTelemetry: false;
    readonly elapsedMs: number;
  };
}

export interface ResourceModule {
  readonly resourceType: SupportedFhirResourceType;
  readonly profileUrl: string;
  readonly jsonRules: readonly MappingRule[];
  readonly hl7Rules?: readonly MappingRule[];
  readonly sampleJson: string;
  readonly sampleHl7?: string;
}

export interface PipelineCodeRequest {
  readonly pipelineName: string;
  readonly rules: readonly MappingRule[];
  readonly target: CodegenTarget;
  readonly sourceFormat: SourceFormat;
  readonly resourceType?: SupportedFhirResourceType;
}

export interface IntegrationPackageRequest extends PipelineCodeRequest {
  readonly sampleInput: string;
}

export interface IntegrationPackageFile {
  readonly path: string;
  readonly language:
    | "json"
    | "markdown"
    | "typescript"
    | "python"
    | "javascript"
    | "text";
  readonly content: string;
}

export interface IntegrationPackage {
  readonly packageName: string;
  readonly files: readonly IntegrationPackageFile[];
}

export interface IntegrationBundleRequest {
  readonly bundleName: string;
  readonly packages: readonly IntegrationPackageRequest[];
}

export interface IntegrationBundle {
  readonly bundleName: string;
  readonly packages: readonly IntegrationPackage[];
  readonly files: readonly IntegrationPackageFile[];
}

export interface ParseResult {
  readonly payload: JsonObject | null;
  readonly issues: readonly TransformIssue[];
}
