import { generatePipelineCode } from "../generation/codegen";
import { FHIR_R4_VERSION } from "../fhir/versions";
import type {
  CodegenTarget,
  IntegrationBundle,
  IntegrationBundleRequest,
  IntegrationPackage,
  IntegrationPackageFile,
  IntegrationPackageRequest,
  JsonObject,
  JsonValue,
  ParseResult,
  SourceFormat,
} from "../core/types";

const FHIR_R4_PROFILE_BASE = "http://hl7.org/fhir/StructureDefinition/";

type ParseLegacyPayload = (
  rawPayload: string,
  sourceFormat: SourceFormat,
) => ParseResult;

export function generateIntegrationPackage(
  request: IntegrationPackageRequest,
  parseLegacyPayload: ParseLegacyPayload,
): IntegrationPackage {
  const packageName = toKebabCase(request.pipelineName);
  const resourceType = request.resourceType ?? "Patient";
  const pipelinePath = pipelineFileName(request.target, resourceType);
  const samplePath = sampleFileName(request.sourceFormat);
  const testPath = testFileName(request.target, resourceType);
  const mappingDefinition = {
    schemaVersion: "interopmed.mapping.v1",
    fhirVersion: FHIR_R4_VERSION,
    name: request.pipelineName,
    sourceFormat: request.sourceFormat,
    target: `FHIR_R4_${resourceType}`,
    fhirProfile: resourceProfile(resourceType),
    validation: {
      mode: "generated-profile",
      optionalExternalValidatorAdapter: true,
    },
    stateless: true,
    persistedPhi: false,
    externalTelemetry: false,
    rules: request.rules,
  };
  const packageManifest = {
    schemaVersion: "interopmed.package.v1",
    fhirVersion: FHIR_R4_VERSION,
    packageName,
    pipelineName: request.pipelineName,
    resourceType,
    sourceFormat: request.sourceFormat,
    target: request.target,
    fhirProfile: resourceProfile(resourceType),
    files: [
      "interopmed-package.json",
      "mapping.json",
      pipelinePath,
      samplePath,
      testPath,
      "README.md",
    ],
  };

  return {
    packageName,
    files: [
      {
        path: "interopmed-package.json",
        language: "json",
        content: JSON.stringify(packageManifest, null, 2),
      },
      {
        path: "mapping.json",
        language: "json",
        content: JSON.stringify(mappingDefinition, null, 2),
      },
      {
        path: pipelinePath,
        language: codeLanguage(request.target),
        content: generatePipelineCode(request),
      },
      {
        path: samplePath,
        language: request.sourceFormat === "json" ? "json" : "text",
        content: request.sampleInput,
      },
      {
        path: testPath,
        language: codeLanguage(request.target),
        content: generatePackageTest(request, pipelinePath, parseLegacyPayload),
      },
      {
        path: "README.md",
        language: "markdown",
        content: generatePackageReadme(request, pipelinePath),
      },
    ],
  };
}

export function generateIntegrationBundle(
  request: IntegrationBundleRequest,
  parseLegacyPayload: ParseLegacyPayload,
): IntegrationBundle {
  const bundleName = toKebabCase(request.bundleName);
  const packages = request.packages.map((packageRequest) =>
    generateIntegrationPackage(packageRequest, parseLegacyPayload),
  );
  const packagePaths = uniquePackagePaths(packages.map((generatedPackage) => generatedPackage.packageName));
  const manifest = {
    schemaVersion: "interopmed.bundle.v1",
    fhirVersion: FHIR_R4_VERSION,
    bundleName,
    packageCount: packages.length,
    resources: request.packages.map((packageRequest, index) => {
      const resourceType = packageRequest.resourceType ?? "Patient";
      const generatedPackage = packages[index];
      const packagePath = packagePaths[index];

      return {
        resourceType,
        sourceFormat: packageRequest.sourceFormat,
        target: packageRequest.target,
        fhirProfile: resourceProfile(resourceType),
        packageName: generatedPackage.packageName,
        path: `${packagePath}/`,
        files: generatedPackage.files.map((file) => file.path),
      };
    }),
  };
  const files: IntegrationPackageFile[] = [
    {
      path: "interopmed-bundle.json",
      language: "json",
      content: JSON.stringify(manifest, null, 2),
    },
    ...packages.flatMap((generatedPackage, packageIndex) =>
      generatedPackage.files.map((file) => ({
        ...file,
        path: `${packagePaths[packageIndex]}/${file.path}`,
      })),
    ),
  ];

  return {
    bundleName,
    packages,
    files,
  };
}

function uniquePackagePaths(packageNames: readonly string[]): string[] {
  const seen = new Map<string, number>();

  return packageNames.map((packageName) => {
    const count = seen.get(packageName) ?? 0;
    seen.set(packageName, count + 1);

    return count === 0 ? packageName : `${packageName}-${count + 1}`;
  });
}

function generatePackageTest(
  request: IntegrationPackageRequest,
  pipelinePath: string,
  parseLegacyPayload: ParseLegacyPayload,
): string {
  const resourceType = request.resourceType ?? "Patient";
  const functionName =
    request.target === "python"
      ? toSnakeCase(request.pipelineName)
      : toIdentifier(request.pipelineName);

  if (request.target === "python") {
    return `from ${pipelinePath.replace(".py", "")} import ${functionName}

def test_${functionName}_returns_fhir_resource():
    sample = ${JSON.stringify(sampleAsPythonValue(request, parseLegacyPayload), null, 4)}
    result = ${functionName}(sample)
    assert result["resourceType"] == "${resourceType}"
    assert "meta" in result
`;
  }

  const importLine =
    request.target === "typescript"
      ? `import { ${functionName} } from "./${pipelinePath.replace(".ts", "")}";`
      : `const { ${functionName} } = require("./${pipelinePath}");`;

  return `${importLine}

const sample = ${JSON.stringify(sampleAsJsonObject(request, parseLegacyPayload), null, 2)};
const result = ${functionName}(sample);

if (result.resourceType !== "${resourceType}") {
  throw new Error("Expected FHIR ${resourceType} resourceType.");
}

if (!result.meta || !Array.isArray(result.meta.profile)) {
  throw new Error("Expected FHIR meta.profile array.");
}
`;
}

function generatePackageReadme(
  request: IntegrationPackageRequest,
  pipelinePath: string,
): string {
  const resourceType = request.resourceType ?? "Patient";
  return `# ${request.pipelineName}

Generated by InteropMed Studio.

## Contract

- Source format: \`${request.sourceFormat}\`
- Target resource: \`FHIR R4 ${resourceType}\`
- FHIR profile: \`${resourceProfile(resourceType)}\`
- Validation mode: generated profile constraints, with optional external validator adapter support
- Runtime posture: stateless, in-memory
- Persistent PHI storage: none
- External telemetry: none

## Files

- \`mapping.json\`: versioned mapping definition for source control.
- \`${pipelinePath}\`: generated pipeline implementation.
- \`${testFileName(request.target, resourceType)}\`: smoke test for generated output shape.
- \`${sampleFileName(request.sourceFormat)}\`: synthetic sample input.

## Integration Notes

Review identifier systems, code systems, local patient identifier policy, and required FHIR profiles before using this in a production interface. The generated package is intended to be committed into the consuming project and tested in that project's CI pipeline.
`;
}

function sampleAsJsonObject(
  request: IntegrationPackageRequest,
  parseLegacyPayload: ParseLegacyPayload,
): JsonObject {
  const parsed = parseLegacyPayload(request.sampleInput, request.sourceFormat);
  return parsed.payload ?? {};
}

function sampleAsPythonValue(
  request: IntegrationPackageRequest,
  parseLegacyPayload: ParseLegacyPayload,
): JsonValue {
  return sampleAsJsonObject(request, parseLegacyPayload);
}

function pipelineFileName(target: CodegenTarget, resourceType: string = "Patient"): string {
  const prefix = `${resourceType.toLowerCase()}-pipeline`;

  if (target === "typescript") {
    return `${prefix}.ts`;
  }

  if (target === "python") {
    return `${prefix}.py`;
  }

  return `${prefix}.js`;
}

function testFileName(target: CodegenTarget, resourceType: string = "Patient"): string {
  const prefix = `${resourceType.toLowerCase()}-pipeline`;

  if (target === "typescript") {
    return `${prefix}.test.ts`;
  }

  if (target === "python") {
    return `test_${prefix}.py`;
  }

  return `${prefix}.test.js`;
}

function sampleFileName(sourceFormat: SourceFormat): string {
  return sourceFormat === "json" ? "sample-input.json" : "sample-input.hl7";
}

function codeLanguage(
  target: CodegenTarget,
): "typescript" | "python" | "javascript" {
  if (target === "typescript") {
    return "typescript";
  }

  if (target === "python") {
    return "python";
  }

  return "javascript";
}

function resourceProfile(resourceType: string): string {
  return `${FHIR_R4_PROFILE_BASE}${resourceType}`;
}

function toIdentifier(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9_$]/g, " ");
  const words = sanitized.split(" ").filter(Boolean);
  const identifier = words
    .map((word, index) =>
      index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join("");

  return /^[a-zA-Z_$]/.test(identifier) ? identifier : `pipeline${identifier}`;
}

function toSnakeCase(value: string): string {
  const identifier = toIdentifier(value);
  return identifier.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toKebabCase(value: string): string {
  return toSnakeCase(value).replace(/_/g, "-");
}
