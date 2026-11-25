# InteropMed Transform Engine

Dependency-free TypeScript primitives for parsing legacy healthcare payloads, mapping them to FHIR R4, validating generated resources, and exporting integration packages.

InteropMed Transform Engine is designed to be embedded in Studio, backend services, ETL jobs, interface engines, migration scripts, browser tools, connectors, and CI checks.

This package is the transformation and mapping engine. It is not the future SHIN Platform Core that will own shared platform services such as patient identity, users, roles, audit, consent, events, and module governance.

## What It Does

- Parses legacy JSON and HL7 v2 payloads.
- Maps source fields to FHIR R4 resource paths with editable rules.
- Includes starter modules for all FHIR R4 resource types.
- Provides richer starter mappings for common clinical resources such as Patient, Observation, Encounter, Condition, Procedure, MedicationRequest, DiagnosticReport, DocumentReference, Immunization, and ServiceRequest.
- Applies healthcare transforms such as compact date conversion, administrative gender normalization, and identifier system normalization.
- Runs lightweight generated FHIR compatibility checks.
- Produces FHIR-style OperationOutcome results.
- Generates starter pipeline code for TypeScript, Python, and Node.js.
- Exports individual integration packages and multi-package bundles with manifests.

## Install

```bash
npm install @interopmed/transform-engine
```

## Quick Start

```ts
import { InteropEngine } from "@interopmed/transform-engine";

const result = InteropEngine.runResourcePipeline(
  JSON.stringify({
    patient_id: "Patient/example-123",
    status: "final",
    code: "8480-6",
    value: 120,
    unit: "mmHg",
  }),
  "json",
  "Observation",
);

if (result.fhirCompatible && result.output !== null) {
  console.log(result.output);
} else {
  console.log(result.operationOutcome);
}
```

## Parse HL7 v2

```ts
import { InteropEngine } from "@interopmed/transform-engine";

const hl7 = [
  "MSH|^~\\&|SYNTH|TEST|INTEROPMED|LOCAL|202605270900||ADT^A01|MSG00001|P|2.5",
  "PID|1||example-123^^^SYNTH^MR||Morgan^Alex||19800101|F",
].join("\r");

const parsed = InteropEngine.parseLegacyPayload(hl7, "hl7v2");

if (parsed.payload !== null) {
  console.log(parsed.payload.PID);
}
```

The HL7 parser supports segment parsing, repeats, components, subcomponents, escape sequences, MLLP-style framing characters, and message metadata.

## Use Resource Modules

```ts
import { InteropEngine, getResourceModule } from "@interopmed/transform-engine";

const observation = getResourceModule("Observation");

const result = InteropEngine.runResourcePipeline(
  observation.sampleJson,
  "json",
  "Observation",
  observation.jsonRules,
);
```

## Generate Pipeline Code

```ts
import { InteropEngine, getResourceModule } from "@interopmed/transform-engine";

const patient = getResourceModule("Patient");

const code = InteropEngine.generatePipelineCode({
  pipelineName: "Patient Mapper",
  resourceType: "Patient",
  sourceFormat: "json",
  target: "typescript",
  rules: patient.jsonRules,
});

console.log(code);
```

Supported code targets:

- `typescript`
- `python`
- `node`

## Export An Integration Package

```ts
import { InteropEngine, getResourceModule } from "@interopmed/transform-engine";

const patient = getResourceModule("Patient");

const pkg = InteropEngine.generateIntegrationPackage({
  pipelineName: "Patient Mapper",
  resourceType: "Patient",
  sourceFormat: "json",
  target: "typescript",
  rules: patient.jsonRules,
  sampleInput: patient.sampleJson,
});

console.log(pkg.packageName);
console.log(pkg.files.map((file) => file.path));
```

Generated packages include:

```text
interopmed-package.json
mapping.json
pipeline source
sample input
smoke test
README.md
```

## Export A Bundle

```ts
import { InteropEngine, getResourceModule } from "@interopmed/transform-engine";

const patient = getResourceModule("Patient");
const observation = getResourceModule("Observation");

const bundle = InteropEngine.generateIntegrationBundle({
  bundleName: "Lab Result Bundle",
  packages: [
    {
      pipelineName: "Patient Mapper",
      resourceType: "Patient",
      sourceFormat: "json",
      target: "typescript",
      rules: patient.jsonRules,
      sampleInput: patient.sampleJson,
    },
    {
      pipelineName: "Observation Labs Mapper",
      resourceType: "Observation",
      sourceFormat: "json",
      target: "typescript",
      rules: observation.jsonRules,
      sampleInput: observation.sampleJson,
    },
  ],
});

console.log(bundle.files[0].path); // interopmed-bundle.json
```

Bundle export includes a top-level manifest and nested package folders. Duplicate package names are assigned unique bundle paths.

## Production Integration Pattern

InteropMed Transform Engine is not a full interface engine or platform core. It is the mapping and packaging layer that you wrap with production infrastructure:

```text
legacy feed/API/file
  -> parse and map with InteropMed Transform Engine
  -> validate generated FHIR
  -> send to FHIR server or downstream API
```

Production systems should add:

- authentication and authorization;
- retry and dead-letter queues;
- audit logging;
- PHI-safe observability;
- patient matching;
- terminology mapping;
- external FHIR server validation;
- deployment and compliance controls.

## FHIR Version

The current production target is FHIR R4. R5 support should be added as versioned modules rather than replacing R4 behavior.

Recommended model:

```text
FHIR R4: stable/default
FHIR R5: preview/opt-in until resource modules and validators are complete
```

## Development

Run tests from the workspace root:

```bash
npm test -w @interopmed/transform-engine
```

## License

MIT
