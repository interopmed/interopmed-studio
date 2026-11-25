import type { SupportedFhirResourceType } from "../core/types";

export const FHIR_R4_PROFILE_BASE =
  "http://hl7.org/fhir/StructureDefinition/";
export const FHIR_R4_PATIENT_PROFILE = `${FHIR_R4_PROFILE_BASE}Patient`;

export function resourceProfile(
  resourceType: SupportedFhirResourceType,
): string {
  return `${FHIR_R4_PROFILE_BASE}${resourceType}`;
}
