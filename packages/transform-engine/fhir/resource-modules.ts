import { fhirR4ResourceTypes } from "./fhir-r4-resources";
import { FHIR_R4_PATIENT_PROFILE, resourceProfile } from "./profiles";
import type {
  JsonObject,
  MappingRule,
  ResourceModule,
  SourceFormat,
  SupportedFhirResourceType,
} from "../core/types";

const FHIR_PATIENT_RESOURCE_TYPE = "Patient";
const FHIR_IDENTIFIER_SYSTEM = "urn:interopmed:synthetic-patient-id";
export const jsonPatientRules: readonly MappingRule[] = [
  {
    id: "json-patient-id",
    label: "Patient identifier",
    sourcePath: "$.patient_id",
    targetPath: "$.identifier[0].value",
    required: true,
    transform: "trim",
  },
  {
    id: "json-patient-id-system",
    label: "Identifier system",
    sourcePath: "$.__interopmed_identifier_system",
    targetPath: "$.identifier[0].system",
    transform: "none",
    fallback: FHIR_IDENTIFIER_SYSTEM,
  },
  {
    id: "json-patient-given",
    label: "Given name",
    sourcePath: "$.given_name",
    targetPath: "$.name[0].given[0]",
    required: true,
    transform: "trim",
  },
  {
    id: "json-patient-family",
    label: "Family name",
    sourcePath: "$.family_name",
    targetPath: "$.name[0].family",
    required: true,
    transform: "trim",
  },
  {
    id: "json-patient-birth-date",
    label: "Birth date",
    sourcePath: "$.birth_date",
    targetPath: "$.birthDate",
    transform: "compactDateToIso",
  },
  {
    id: "json-patient-gender",
    label: "Administrative gender",
    sourcePath: "$.gender",
    targetPath: "$.gender",
    transform: "fhirAdministrativeGender",
    fallback: "unknown",
  },
];

export const hl7PatientRules: readonly MappingRule[] = [
  {
    id: "hl7-patient-id",
    label: "PID-3 identifier",
    sourcePath: "$.PID[0][3][0][0]",
    targetPath: "$.identifier[0].value",
    required: true,
    transform: "trim",
  },
  {
    id: "hl7-patient-id-system",
    label: "PID-3 assigning authority",
    sourcePath: "$.PID[0][3][0][3]",
    targetPath: "$.identifier[0].system",
    transform: "fhirIdentifierSystem",
    fallback: FHIR_IDENTIFIER_SYSTEM,
  },
  {
    id: "hl7-family-name",
    label: "PID-5 family",
    sourcePath: "$.PID[0][5][0][0]",
    targetPath: "$.name[0].family",
    required: true,
    transform: "trim",
  },
  {
    id: "hl7-given-name",
    label: "PID-5 given",
    sourcePath: "$.PID[0][5][0][1]",
    targetPath: "$.name[0].given[0]",
    required: true,
    transform: "trim",
  },
  {
    id: "hl7-birth-date",
    label: "PID-7 birth date",
    sourcePath: "$.PID[0][7][0][0]",
    targetPath: "$.birthDate",
    transform: "compactDateToIso",
  },
  {
    id: "hl7-gender",
    label: "PID-8 gender",
    sourcePath: "$.PID[0][8][0][0]",
    targetPath: "$.gender",
    transform: "fhirAdministrativeGender",
    fallback: "unknown",
  },
];

/** @deprecated Use `jsonPatientRules` instead. This alias re-exports the entire Patient rule set, not just name-related rules. */
export const patientNameRules = jsonPatientRules;

function jsonRulesFor(
  resourceType: SupportedFhirResourceType,
  rules: readonly Omit<MappingRule, "id">[],
): readonly MappingRule[] {
  return rules.map((rule, index) => ({
    ...rule,
    id: `${resourceType.toLowerCase()}-json-${index + 1}`,
  }));
}

const commonSubjectRules = [
  {
    label: "Subject patient reference",
    sourcePath: "$.patient_id",
    targetPath: "$.subject.reference",
    required: true,
    transform: "trim" as const,
    fallback: "Patient/example-123",
  },
];

const commonResourceEnvelopeRules: readonly Omit<MappingRule, "id">[] = [
  {
    label: "Logical id",
    sourcePath: "$.id",
    targetPath: "$.id",
    transform: "trim",
  },
  {
    label: "Narrative status",
    sourcePath: "$.text_status",
    targetPath: "$.text.status",
    fallback: "generated",
  },
  {
    label: "Narrative",
    sourcePath: "$.text_div",
    targetPath: "$.text.div",
    transform: "trim",
  },
];

const resourceModuleOverrides: readonly ResourceModule[] = [
  {
    resourceType: "Patient",
    profileUrl: FHIR_R4_PATIENT_PROFILE,
    jsonRules: jsonPatientRules,
    hl7Rules: hl7PatientRules,
    sampleJson: `{
  "patient_id": "example-123",
  "given_name": "Alex",
  "family_name": "Morgan",
  "birth_date": "19800101",
  "gender": "FEMALE"
}`,
    sampleHl7: `MSH|^~\\&|SYNTH|TEST|INTEROPMED|LOCAL|202605270900||ADT^A01|MSG00001|P|2.5
PID|1||example-123^^^SYNTH^MR||Morgan^Alex||19800101|F`,
  },
  {
    resourceType: "Observation",
    profileUrl: resourceProfile("Observation"),
    jsonRules: jsonRulesFor("Observation", [
      { label: "Status", sourcePath: "$.status", targetPath: "$.status", fallback: "final" },
      { label: "LOINC code", sourcePath: "$.code", targetPath: "$.code.coding[0].code", required: true, transform: "trim" },
      { label: "Display", sourcePath: "$.display", targetPath: "$.code.coding[0].display", transform: "trim" },
      { label: "Coding system", sourcePath: "$.system", targetPath: "$.code.coding[0].system", fallback: "http://loinc.org" },
      ...commonSubjectRules,
      { label: "Value", sourcePath: "$.value", targetPath: "$.valueQuantity.value", required: true },
      { label: "Unit", sourcePath: "$.unit", targetPath: "$.valueQuantity.unit", transform: "trim" },
      { label: "Effective date", sourcePath: "$.effectiveDateTime", targetPath: "$.effectiveDateTime", transform: "trim" },
    ]),
    sampleJson: `{
  "patient_id": "Patient/example-123",
  "status": "final",
  "code": "8480-6",
  "display": "Systolic blood pressure",
  "value": 120,
  "unit": "mmHg",
  "effectiveDateTime": "2026-05-27T09:00:00Z"
}`,
  },
  {
    resourceType: "Encounter",
    profileUrl: resourceProfile("Encounter"),
    jsonRules: jsonRulesFor("Encounter", [
      { label: "Status", sourcePath: "$.status", targetPath: "$.status", fallback: "finished" },
      { label: "Class code", sourcePath: "$.class_code", targetPath: "$.class.code", fallback: "AMB" },
      { label: "Class system", sourcePath: "$.class_system", targetPath: "$.class.system", fallback: "http://terminology.hl7.org/CodeSystem/v3-ActCode" },
      ...commonSubjectRules,
      { label: "Start", sourcePath: "$.start", targetPath: "$.period.start", transform: "trim" },
      { label: "End", sourcePath: "$.end", targetPath: "$.period.end", transform: "trim" },
    ]),
    sampleJson: `{
  "patient_id": "Patient/example-123",
  "status": "finished",
  "class_code": "AMB",
  "start": "2026-05-27T08:30:00Z",
  "end": "2026-05-27T09:15:00Z"
}`,
  },
  {
    resourceType: "Condition",
    profileUrl: resourceProfile("Condition"),
    jsonRules: jsonRulesFor("Condition", [
      { label: "Clinical status", sourcePath: "$.clinical_status", targetPath: "$.clinicalStatus.coding[0].code", fallback: "active" },
      { label: "Code", sourcePath: "$.code", targetPath: "$.code.coding[0].code", required: true, transform: "trim" },
      { label: "Display", sourcePath: "$.display", targetPath: "$.code.coding[0].display", transform: "trim" },
      ...commonSubjectRules,
      { label: "Recorded date", sourcePath: "$.recordedDate", targetPath: "$.recordedDate", transform: "trim" },
    ]),
    sampleJson: `{
  "patient_id": "Patient/example-123",
  "clinical_status": "active",
  "code": "44054006",
  "display": "Diabetes mellitus type 2",
  "recordedDate": "2026-05-27"
}`,
  },
  {
    resourceType: "Procedure",
    profileUrl: resourceProfile("Procedure"),
    jsonRules: jsonRulesFor("Procedure", [
      { label: "Status", sourcePath: "$.status", targetPath: "$.status", fallback: "completed" },
      { label: "Code", sourcePath: "$.code", targetPath: "$.code.coding[0].code", required: true, transform: "trim" },
      { label: "Display", sourcePath: "$.display", targetPath: "$.code.coding[0].display", transform: "trim" },
      ...commonSubjectRules,
      { label: "Performed", sourcePath: "$.performedDateTime", targetPath: "$.performedDateTime", transform: "trim" },
    ]),
    sampleJson: `{
  "patient_id": "Patient/example-123",
  "status": "completed",
  "code": "80146002",
  "display": "Appendectomy",
  "performedDateTime": "2026-05-27T10:00:00Z"
}`,
  },
  {
    resourceType: "MedicationRequest",
    profileUrl: resourceProfile("MedicationRequest"),
    jsonRules: jsonRulesFor("MedicationRequest", [
      { label: "Status", sourcePath: "$.status", targetPath: "$.status", fallback: "active" },
      { label: "Intent", sourcePath: "$.intent", targetPath: "$.intent", fallback: "order" },
      { label: "Medication text", sourcePath: "$.medication", targetPath: "$.medicationCodeableConcept.text", required: true, transform: "trim" },
      ...commonSubjectRules,
      { label: "Authored on", sourcePath: "$.authoredOn", targetPath: "$.authoredOn", transform: "trim" },
    ]),
    sampleJson: `{
  "patient_id": "Patient/example-123",
  "status": "active",
  "intent": "order",
  "medication": "Metformin 500mg tablet",
  "authoredOn": "2026-05-27"
}`,
  },
  {
    resourceType: "MedicationStatement",
    profileUrl: resourceProfile("MedicationStatement"),
    jsonRules: jsonRulesFor("MedicationStatement", [
      { label: "Status", sourcePath: "$.status", targetPath: "$.status", fallback: "active" },
      { label: "Medication text", sourcePath: "$.medication", targetPath: "$.medicationCodeableConcept.text", required: true, transform: "trim" },
      ...commonSubjectRules,
      { label: "Effective date", sourcePath: "$.effectiveDateTime", targetPath: "$.effectiveDateTime", transform: "trim" },
    ]),
    sampleJson: `{
  "patient_id": "Patient/example-123",
  "status": "active",
  "medication": "Atorvastatin 20mg",
  "effectiveDateTime": "2026-05-27"
}`,
  },
  {
    resourceType: "DiagnosticReport",
    profileUrl: resourceProfile("DiagnosticReport"),
    jsonRules: jsonRulesFor("DiagnosticReport", [
      { label: "Status", sourcePath: "$.status", targetPath: "$.status", fallback: "final" },
      { label: "Code", sourcePath: "$.code", targetPath: "$.code.coding[0].code", required: true, transform: "trim" },
      { label: "Display", sourcePath: "$.display", targetPath: "$.code.coding[0].display", transform: "trim" },
      ...commonSubjectRules,
      { label: "Conclusion", sourcePath: "$.conclusion", targetPath: "$.conclusion", transform: "trim" },
    ]),
    sampleJson: `{
  "patient_id": "Patient/example-123",
  "status": "final",
  "code": "58410-2",
  "display": "Complete blood count panel",
  "conclusion": "Synthetic report conclusion"
}`,
  },
  {
    resourceType: "DocumentReference",
    profileUrl: resourceProfile("DocumentReference"),
    jsonRules: jsonRulesFor("DocumentReference", [
      { label: "Status", sourcePath: "$.status", targetPath: "$.status", fallback: "current" },
      { label: "Type text", sourcePath: "$.type", targetPath: "$.type.text", required: true, transform: "trim" },
      ...commonSubjectRules,
      { label: "Attachment URL", sourcePath: "$.url", targetPath: "$.content[0].attachment.url", transform: "trim" },
      { label: "Attachment title", sourcePath: "$.title", targetPath: "$.content[0].attachment.title", transform: "trim" },
    ]),
    sampleJson: `{
  "patient_id": "Patient/example-123",
  "status": "current",
  "type": "Discharge summary",
  "url": "urn:interopmed:document:example",
  "title": "Synthetic discharge summary"
}`,
  },
  {
    resourceType: "Organization",
    profileUrl: resourceProfile("Organization"),
    jsonRules: jsonRulesFor("Organization", [
      { label: "Name", sourcePath: "$.name", targetPath: "$.name", required: true, transform: "trim" },
      { label: "Active", sourcePath: "$.active", targetPath: "$.active", fallback: true },
      { label: "Identifier", sourcePath: "$.identifier", targetPath: "$.identifier[0].value", transform: "trim" },
    ]),
    sampleJson: `{
  "name": "Synthetic General Hospital",
  "active": true,
  "identifier": "ORG-001"
}`,
  },
  {
    resourceType: "Practitioner",
    profileUrl: resourceProfile("Practitioner"),
    jsonRules: jsonRulesFor("Practitioner", [
      { label: "Identifier", sourcePath: "$.identifier", targetPath: "$.identifier[0].value", required: true, transform: "trim" },
      { label: "Family", sourcePath: "$.family", targetPath: "$.name[0].family", required: true, transform: "trim" },
      { label: "Given", sourcePath: "$.given", targetPath: "$.name[0].given[0]", transform: "trim" },
    ]),
    sampleJson: `{
  "identifier": "PRAC-001",
  "family": "Rivera",
  "given": "Sam"
}`,
  },
  {
    resourceType: "PractitionerRole",
    profileUrl: resourceProfile("PractitionerRole"),
    jsonRules: jsonRulesFor("PractitionerRole", [
      { label: "Practitioner", sourcePath: "$.practitioner", targetPath: "$.practitioner.reference", required: true, fallback: "Practitioner/PRAC-001" },
      { label: "Organization", sourcePath: "$.organization", targetPath: "$.organization.reference", fallback: "Organization/ORG-001" },
      { label: "Active", sourcePath: "$.active", targetPath: "$.active", fallback: true },
    ]),
    sampleJson: `{
  "practitioner": "Practitioner/PRAC-001",
  "organization": "Organization/ORG-001",
  "active": true
}`,
  },
  {
    resourceType: "RelatedPerson",
    profileUrl: resourceProfile("RelatedPerson"),
    jsonRules: jsonRulesFor("RelatedPerson", [
      ...commonSubjectRules,
      { label: "Family", sourcePath: "$.family", targetPath: "$.name[0].family", required: true, transform: "trim" },
      { label: "Given", sourcePath: "$.given", targetPath: "$.name[0].given[0]", transform: "trim" },
      { label: "Relationship text", sourcePath: "$.relationship", targetPath: "$.relationship[0].text", transform: "trim" },
    ]),
    sampleJson: `{
  "patient_id": "Patient/example-123",
  "family": "Morgan",
  "given": "Taylor",
  "relationship": "Emergency contact"
}`,
  },
  {
    resourceType: "AllergyIntolerance",
    profileUrl: resourceProfile("AllergyIntolerance"),
    jsonRules: jsonRulesFor("AllergyIntolerance", [
      { label: "Clinical status", sourcePath: "$.clinical_status", targetPath: "$.clinicalStatus.coding[0].code", fallback: "active" },
      { label: "Code text", sourcePath: "$.allergen", targetPath: "$.code.text", required: true, transform: "trim" },
      { label: "Patient", sourcePath: "$.patient_id", targetPath: "$.patient.reference", required: true, transform: "trim" },
    ]),
    sampleJson: `{
  "patient_id": "Patient/example-123",
  "clinical_status": "active",
  "allergen": "Penicillin"
}`,
  },
  {
    resourceType: "Immunization",
    profileUrl: resourceProfile("Immunization"),
    jsonRules: jsonRulesFor("Immunization", [
      { label: "Status", sourcePath: "$.status", targetPath: "$.status", fallback: "completed" },
      { label: "Vaccine text", sourcePath: "$.vaccine", targetPath: "$.vaccineCode.text", required: true, transform: "trim" },
      { label: "Patient", sourcePath: "$.patient_id", targetPath: "$.patient.reference", required: true, transform: "trim" },
      { label: "Occurrence", sourcePath: "$.occurrenceDateTime", targetPath: "$.occurrenceDateTime", transform: "trim" },
    ]),
    sampleJson: `{
  "patient_id": "Patient/example-123",
  "status": "completed",
  "vaccine": "Influenza vaccine",
  "occurrenceDateTime": "2026-05-27"
}`,
  },
  {
    resourceType: "ServiceRequest",
    profileUrl: resourceProfile("ServiceRequest"),
    jsonRules: jsonRulesFor("ServiceRequest", [
      { label: "Status", sourcePath: "$.status", targetPath: "$.status", fallback: "active" },
      { label: "Intent", sourcePath: "$.intent", targetPath: "$.intent", fallback: "order" },
      { label: "Code text", sourcePath: "$.service", targetPath: "$.code.text", required: true, transform: "trim" },
      ...commonSubjectRules,
    ]),
    sampleJson: `{
  "patient_id": "Patient/example-123",
  "status": "active",
  "intent": "order",
  "service": "CBC panel"
}`,
  },
];

export const resourceModules: readonly ResourceModule[] = fhirR4ResourceTypes.map(
  (resourceType) =>
    completeResourceModule(
      resourceModuleOverrides.find(
        (module) => module.resourceType === resourceType,
      ) ?? createGenericResourceModule(resourceType),
    ),
);

export function getResourceModule(
  resourceType: SupportedFhirResourceType,
): ResourceModule {
  const module = resourceModules.find(
    (candidate) => candidate.resourceType === resourceType,
  );

  if (module === undefined) {
    throw new Error(`Unsupported FHIR resource type: ${resourceType}`);
  }

  return module;
}

function createGenericResourceModule(
  resourceType: SupportedFhirResourceType,
): ResourceModule {
  return {
    resourceType,
    profileUrl: resourceProfile(resourceType),
    jsonRules: jsonRulesFor(resourceType, genericResourceRules(resourceType)),
    sampleJson: genericResourceSample(resourceType),
  };
}

function completeResourceModule(module: ResourceModule): ResourceModule {
  const missingEnvelopeRules = commonResourceEnvelopeRules.filter(
    (rule) =>
      !module.jsonRules.some(
        (existingRule) => existingRule.targetPath === rule.targetPath,
      ),
  );

  if (missingEnvelopeRules.length === 0) {
    return module;
  }

  return {
    ...module,
    jsonRules: jsonRulesFor(module.resourceType, [
      ...missingEnvelopeRules,
      ...module.jsonRules,
    ]),
  };
}

function genericResourceRules(
  resourceType: SupportedFhirResourceType,
): readonly Omit<MappingRule, "id">[] {
  const rules: Omit<MappingRule, "id">[] = [
    ...commonResourceEnvelopeRules.map((rule) =>
      rule.targetPath === "$.id"
        ? { ...rule, fallback: `${resourceType.toLowerCase()}-example` }
        : rule.targetPath === "$.text.div"
          ? {
              ...rule,
              fallback: `<div xmlns="http://www.w3.org/1999/xhtml">Synthetic ${resourceType} resource generated by InteropMed</div>`,
            }
          : rule,
    ),
    {
      label: "Identifier value",
      sourcePath: "$.identifier",
      targetPath: "$.identifier[0].value",
      transform: "trim",
    },
    {
      label: "Identifier system",
      sourcePath: "$.identifier_system",
      targetPath: "$.identifier[0].system",
      transform: "fhirIdentifierSystem",
      fallback: `urn:interopmed:${resourceType.toLowerCase()}`,
    },
  ];

  if (hasWorkflowStatus(resourceType)) {
    rules.push({
      label: "Status",
      sourcePath: "$.status",
      targetPath: "$.status",
      fallback: defaultStatusFor(resourceType),
    });
  }

  if (hasCodeableConcept(resourceType)) {
    rules.push(
      {
        label: "Code",
        sourcePath: "$.code",
        targetPath: "$.code.coding[0].code",
        transform: "trim",
      },
      {
        label: "Code display",
        sourcePath: "$.display",
        targetPath: "$.code.coding[0].display",
        transform: "trim",
      },
      {
        label: "Code system",
        sourcePath: "$.system",
        targetPath: "$.code.coding[0].system",
        fallback: "urn:interopmed:code-system",
      },
    );
  }

  if (hasName(resourceType)) {
    rules.push({
      label: "Name",
      sourcePath: "$.name",
      targetPath: "$.name",
      required: ["Organization", "Location", "Endpoint"].includes(resourceType),
      transform: "trim",
    });
  }

  if (hasTitle(resourceType)) {
    rules.push({
      label: "Title",
      sourcePath: "$.title",
      targetPath: "$.title",
      transform: "trim",
    });
  }

  if (hasDescription(resourceType)) {
    rules.push({
      label: "Description",
      sourcePath: "$.description",
      targetPath: "$.description",
      transform: "trim",
    });
  }

  if (hasSubject(resourceType)) {
    rules.push({
      label: "Subject patient reference",
      sourcePath: "$.patient_id",
      targetPath: "$.subject.reference",
      transform: "trim",
      fallback: "Patient/example-123",
    });
  }

  if (hasPatientReference(resourceType)) {
    rules.push({
      label: "Patient reference",
      sourcePath: "$.patient_id",
      targetPath: "$.patient.reference",
      transform: "trim",
      fallback: "Patient/example-123",
    });
  }

  if (hasEncounterReference(resourceType)) {
    rules.push({
      label: "Encounter reference",
      sourcePath: "$.encounter_id",
      targetPath: "$.encounter.reference",
      transform: "trim",
    });
  }

  if (hasAuthoredDate(resourceType)) {
    rules.push({
      label: "Authored date",
      sourcePath: "$.authoredOn",
      targetPath: "$.authoredOn",
      transform: "trim",
    });
  }

  if (hasOccurrenceDate(resourceType)) {
    rules.push({
      label: "Occurrence date",
      sourcePath: "$.occurrenceDateTime",
      targetPath: "$.occurrenceDateTime",
      transform: "trim",
    });
  }

  if (hasEffectiveDate(resourceType)) {
    rules.push({
      label: "Effective date",
      sourcePath: "$.effectiveDateTime",
      targetPath: "$.effectiveDateTime",
      transform: "trim",
    });
  }

  if (hasPeriod(resourceType)) {
    rules.push(
      {
        label: "Period start",
        sourcePath: "$.start",
        targetPath: "$.period.start",
        transform: "trim",
      },
      {
        label: "Period end",
        sourcePath: "$.end",
        targetPath: "$.period.end",
        transform: "trim",
      },
    );
  }

  if (hasUrl(resourceType)) {
    rules.push({
      label: "Canonical URL",
      sourcePath: "$.url",
      targetPath: "$.url",
      transform: "trim",
    });
  }

  if (hasVersion(resourceType)) {
    rules.push({
      label: "Version",
      sourcePath: "$.version",
      targetPath: "$.version",
      transform: "trim",
    });
  }

  if (hasActiveFlag(resourceType)) {
    rules.push({
      label: "Active",
      sourcePath: "$.active",
      targetPath: "$.active",
      fallback: true,
    });
  }

  if (hasQuantityValue(resourceType)) {
    rules.push(
      {
        label: "Value",
        sourcePath: "$.value",
        targetPath: "$.valueQuantity.value",
      },
      {
        label: "Unit",
        sourcePath: "$.unit",
        targetPath: "$.valueQuantity.unit",
        transform: "trim",
      },
    );
  }

  return uniqueRulesByTargetPath(rules);
}

function genericResourceSample(resourceType: SupportedFhirResourceType): string {
  const sample = {
    id: `${resourceType.toLowerCase()}-example`,
    identifier: `${resourceType.toUpperCase()}-001`,
    identifier_system: `urn:interopmed:${resourceType.toLowerCase()}`,
    status: defaultStatusFor(resourceType),
    code: "example-code",
    display: `Synthetic ${resourceType}`,
    system: "urn:interopmed:code-system",
    name: `Synthetic ${resourceType}`,
    title: `Synthetic ${resourceType}`,
    description: `Synthetic ${resourceType} resource generated by InteropMed`,
    patient_id: "Patient/example-123",
    encounter_id: "Encounter/example-123",
    authoredOn: "2026-05-27",
    occurrenceDateTime: "2026-05-27T09:00:00Z",
    effectiveDateTime: "2026-05-27T09:00:00Z",
    start: "2026-05-27T08:30:00Z",
    end: "2026-05-27T09:15:00Z",
    url: `http://example.org/fhir/${resourceType}/synthetic`,
    version: "1.0.0",
    active: true,
    value: 1,
    unit: "count",
    text_status: "generated",
    text_div: `<div xmlns="http://www.w3.org/1999/xhtml">Synthetic ${resourceType} resource generated by InteropMed</div>`,
  };

  return JSON.stringify(sample, null, 2);
}

function uniqueRulesByTargetPath(
  rules: readonly Omit<MappingRule, "id">[],
): readonly Omit<MappingRule, "id">[] {
  const seen = new Set<string>();
  return rules.filter((rule) => {
    if (seen.has(rule.targetPath)) {
      return false;
    }

    seen.add(rule.targetPath);
    return true;
  });
}

function hasWorkflowStatus(resourceType: SupportedFhirResourceType): boolean {
  return ![
    "Binary",
    "Bundle",
    "Parameters",
    "Patient",
    "Person",
    "Practitioner",
    "RelatedPerson",
    "Substance",
  ].includes(resourceType);
}

function defaultStatusFor(resourceType: SupportedFhirResourceType): string {
  if (
    [
      "Appointment",
      "Encounter",
      "EpisodeOfCare",
      "Immunization",
      "Procedure",
    ].includes(resourceType)
  ) {
    return "finished";
  }

  if (
    [
      "CarePlan",
      "CommunicationRequest",
      "DeviceRequest",
      "MedicationRequest",
      "ServiceRequest",
      "SupplyRequest",
      "Task",
    ].includes(resourceType)
  ) {
    return "active";
  }

  if (["DocumentReference", "Composition"].includes(resourceType)) {
    return "current";
  }

  return "final";
}

function hasCodeableConcept(resourceType: SupportedFhirResourceType): boolean {
  return [
    "AdverseEvent",
    "AllergyIntolerance",
    "Appointment",
    "Basic",
    "BodyStructure",
    "CarePlan",
    "ChargeItem",
    "ClinicalImpression",
    "Communication",
    "CommunicationRequest",
    "Composition",
    "Condition",
    "DetectedIssue",
    "DeviceRequest",
    "DiagnosticReport",
    "DocumentReference",
    "Encounter",
    "FamilyMemberHistory",
    "Flag",
    "Goal",
    "GuidanceResponse",
    "HealthcareService",
    "ImagingStudy",
    "Immunization",
    "List",
    "MeasureReport",
    "Medication",
    "MedicationAdministration",
    "MedicationDispense",
    "MedicationKnowledge",
    "MedicationRequest",
    "MedicationStatement",
    "NutritionOrder",
    "Observation",
    "Procedure",
    "Questionnaire",
    "QuestionnaireResponse",
    "RiskAssessment",
    "ServiceRequest",
    "Specimen",
    "SupplyDelivery",
    "SupplyRequest",
    "Task",
    "VisionPrescription",
  ].includes(resourceType);
}

function hasName(resourceType: SupportedFhirResourceType): boolean {
  return [
    "Device",
    "DeviceDefinition",
    "Endpoint",
    "Group",
    "HealthcareService",
    "InsurancePlan",
    "Location",
    "Medication",
    "Organization",
    "Practitioner",
    "Substance",
  ].includes(resourceType);
}

function hasTitle(resourceType: SupportedFhirResourceType): boolean {
  return [
    "ActivityDefinition",
    "CapabilityStatement",
    "CodeSystem",
    "Composition",
    "ConceptMap",
    "ImplementationGuide",
    "Library",
    "Measure",
    "PlanDefinition",
    "Questionnaire",
    "ResearchDefinition",
    "ResearchElementDefinition",
    "SearchParameter",
    "StructureDefinition",
    "StructureMap",
    "ValueSet",
  ].includes(resourceType);
}

function hasDescription(resourceType: SupportedFhirResourceType): boolean {
  return [
    "ActivityDefinition",
    "CapabilityStatement",
    "CarePlan",
    "CodeSystem",
    "ConceptMap",
    "Contract",
    "Coverage",
    "DeviceDefinition",
    "ImplementationGuide",
    "InsurancePlan",
    "Library",
    "Measure",
    "OperationDefinition",
    "PlanDefinition",
    "Questionnaire",
    "ResearchDefinition",
    "ResearchElementDefinition",
    "SearchParameter",
    "StructureDefinition",
    "StructureMap",
    "Subscription",
    "ValueSet",
  ].includes(resourceType);
}

function hasSubject(resourceType: SupportedFhirResourceType): boolean {
  return [
    "AdverseEvent",
    "CarePlan",
    "ClinicalImpression",
    "Condition",
    "DetectedIssue",
    "DiagnosticReport",
    "DocumentReference",
    "Encounter",
    "FamilyMemberHistory",
    "Flag",
    "Goal",
    "ImagingStudy",
    "List",
    "MedicationRequest",
    "MedicationStatement",
    "Observation",
    "Procedure",
    "QuestionnaireResponse",
    "RiskAssessment",
    "ServiceRequest",
  ].includes(resourceType);
}

function hasPatientReference(resourceType: SupportedFhirResourceType): boolean {
  return [
    "AllergyIntolerance",
    "Appointment",
    "CareTeam",
    "DeviceUseStatement",
    "Immunization",
    "MedicationAdministration",
    "MedicationDispense",
    "NutritionOrder",
    "RelatedPerson",
    "VisionPrescription",
  ].includes(resourceType);
}

function hasEncounterReference(resourceType: SupportedFhirResourceType): boolean {
  return [
    "AdverseEvent",
    "AllergyIntolerance",
    "ChargeItem",
    "ClinicalImpression",
    "Communication",
    "Composition",
    "Condition",
    "DeviceUseStatement",
    "DiagnosticReport",
    "DocumentReference",
    "ImagingStudy",
    "MedicationAdministration",
    "MedicationRequest",
    "Observation",
    "Procedure",
    "QuestionnaireResponse",
  ].includes(resourceType);
}

function hasAuthoredDate(resourceType: SupportedFhirResourceType): boolean {
  return [
    "CommunicationRequest",
    "DeviceRequest",
    "MedicationRequest",
    "ServiceRequest",
    "SupplyRequest",
    "Task",
  ].includes(resourceType);
}

function hasOccurrenceDate(resourceType: SupportedFhirResourceType): boolean {
  return [
    "AdverseEvent",
    "Immunization",
    "MedicationAdministration",
    "Procedure",
    "SupplyDelivery",
  ].includes(resourceType);
}

function hasEffectiveDate(resourceType: SupportedFhirResourceType): boolean {
  return [
    "ClinicalImpression",
    "DiagnosticReport",
    "MedicationStatement",
    "Observation",
  ].includes(resourceType);
}

function hasPeriod(resourceType: SupportedFhirResourceType): boolean {
  return [
    "Appointment",
    "CarePlan",
    "Encounter",
    "EpisodeOfCare",
    "HealthcareService",
    "InsurancePlan",
    "PractitionerRole",
    "Schedule",
  ].includes(resourceType);
}

function hasUrl(resourceType: SupportedFhirResourceType): boolean {
  return [
    "ActivityDefinition",
    "CapabilityStatement",
    "CodeSystem",
    "CompartmentDefinition",
    "ConceptMap",
    "EventDefinition",
    "GraphDefinition",
    "ImplementationGuide",
    "Library",
    "Measure",
    "MessageDefinition",
    "NamingSystem",
    "OperationDefinition",
    "PlanDefinition",
    "Questionnaire",
    "ResearchDefinition",
    "ResearchElementDefinition",
    "SearchParameter",
    "StructureDefinition",
    "StructureMap",
    "TerminologyCapabilities",
    "TestScript",
    "ValueSet",
  ].includes(resourceType);
}

function hasVersion(resourceType: SupportedFhirResourceType): boolean {
  return hasUrl(resourceType);
}

function hasActiveFlag(resourceType: SupportedFhirResourceType): boolean {
  return [
    "CodeSystem",
    "Device",
    "Endpoint",
    "HealthcareService",
    "Location",
    "Organization",
    "PractitionerRole",
    "ValueSet",
  ].includes(resourceType);
}

function hasQuantityValue(resourceType: SupportedFhirResourceType): boolean {
  return ["Observation", "RiskAssessment", "SupplyDelivery"].includes(resourceType);
}

export function defaultRulesFor(
  resourceType: SupportedFhirResourceType,
  sourceFormat: SourceFormat,
): readonly MappingRule[] {
  const module = getResourceModule(resourceType);

  if (sourceFormat === "hl7v2" && module.hl7Rules !== undefined) {
    return module.hl7Rules;
  }

  return module.jsonRules;
}

export function createBaseResource(
  resourceType: SupportedFhirResourceType,
): JsonObject {
  return {
    resourceType,
    meta: {
      profile: [resourceProfile(resourceType)],
    },
  };
}

