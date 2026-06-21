"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  Code2,
  Clipboard,
  ClipboardCheck,
  Download,
  FileJson,
  GitBranch,
  Layers3,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  InteropEngine,
  type CodegenTarget,
  type FhirVersion,
  type IntegrationPackageRequest,
  type IntegrationPackageFile,
  type MappingRule,
  type ResourceModule,
  type SourceFormat,
  type SupportedFhirResourceType,
  type TransformIssue,
  type TransformName,
  getResourceModule,
  isFhirR4ResourceType,
  resourceModules,
} from "@interopmed/transform-engine";

const codegenTargets: readonly CodegenTarget[] = ["typescript", "python", "node"];
const fhirVersions: readonly FhirVersion[] = ["R4", "R5-preview"];
const transforms: readonly TransformName[] = [
  "none",
  "trim",
  "compactDateToIso",
  "fhirAdministrativeGender",
  "fhirIdentifierSystem",
  "uppercase",
  "lowercase",
];

type BundlePackageDraft = IntegrationPackageRequest & {
  readonly id: string;
  readonly displayName: string;
  readonly resourceType: SupportedFhirResourceType;
};

const initialBundleResourceTypes: readonly SupportedFhirResourceType[] = [
  "Patient",
  "Observation",
  "Encounter",
  "Medication",
];

const workflowTemplates = [
  {
    id: "adt",
    label: "ADT admission",
    resources: ["Patient", "Encounter", "Condition", "Procedure"] as const,
  },
  {
    id: "labs",
    label: "Lab result",
    resources: ["Patient", "Encounter", "Observation", "DiagnosticReport", "Specimen"] as const,
  },
  {
    id: "meds",
    label: "Medication order",
    resources: ["Patient", "Encounter", "Medication", "MedicationRequest", "MedicationStatement"] as const,
  },
  {
    id: "referral",
    label: "Referral",
    resources: ["Patient", "Practitioner", "Organization", "ServiceRequest", "DocumentReference"] as const,
  },
] satisfies readonly {
  readonly id: string;
  readonly label: string;
  readonly resources: readonly SupportedFhirResourceType[];
}[];

export default function StudioWorkspace() {
  const [targetResource, setTargetResource] =
    useState<SupportedFhirResourceType>("Patient");
  const selectedModule = useMemo(
    () => getResourceModule(targetResource),
    [targetResource],
  );
  const availableSourceFormats = useMemo(
    () => sourceFormatsFor(selectedModule),
    [selectedModule],
  );
  const [sourceFormat, setSourceFormat] = useState<SourceFormat>("json");
  const [rawInput, setRawInput] = useState(getResourceModule("Patient").sampleJson);
  const [rules, setRules] = useState<MappingRule[]>([
    ...getResourceModule("Patient").jsonRules,
  ]);
  const [ruleFilter, setRuleFilter] = useState("");
  const [codegenTarget, setCodegenTarget] = useState<CodegenTarget>("typescript");
  const [fhirVersion, setFhirVersion] = useState<FhirVersion>("R4");
  const [editorPipelineName, setEditorPipelineName] = useState(
    defaultPipelineName("json", "Patient"),
  );
  const [copiedPackagePath, setCopiedPackagePath] = useState<string | null>(null);
  const [copiedBundleManifest, setCopiedBundleManifest] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [activeBundlePackageId, setActiveBundlePackageId] = useState(
    defaultBundlePackageId("Patient"),
  );
  const [bundleName, setBundleName] = useState("InteropMed Resource Bundle");
  const [bundlePackages, setBundlePackages] = useState<BundlePackageDraft[]>(() =>
    initialBundleResourceTypes.map((resourceType) =>
      createDefaultBundlePackage(resourceType, "json", "typescript"),
    ),
  );
  const [bundleResourceToAdd, setBundleResourceToAdd] =
    useState<SupportedFhirResourceType>("Condition");
  const [externalValidatorUrl, setExternalValidatorUrl] = useState("");
  const [externalValidationResult, setExternalValidationResult] =
    useState<unknown>(null);
  const [externalValidationStatus, setExternalValidationStatus] =
    useState("Not run");
  const [externalValidationRunning, setExternalValidationRunning] = useState(false);

  const parsed = useMemo(
    () => InteropEngine.parseLegacyPayload(rawInput, sourceFormat),
    [rawInput, sourceFormat],
  );

  const pipelineResult = useMemo(
    () =>
      InteropEngine.runResourcePipeline(
        rawInput,
        sourceFormat,
        targetResource,
        rules,
      ),
    [rawInput, rules, sourceFormat, targetResource],
  );

  const transformResult = useMemo(() => {
    if (parsed.payload === null) {
      return null;
    }

    return InteropEngine.transformToFhirResource(
      targetResource,
      parsed.payload,
      rules,
    );
  }, [parsed.payload, rules, targetResource]);

  const allIssues = useMemo(
    () => [
      ...parsed.issues,
      ...(transformResult?.issues ?? []),
      ...(transformResult?.fhirIssues ?? []),
    ],
    [parsed.issues, transformResult?.issues, transformResult?.fhirIssues],
  );
  const activeSavedBundlePackage =
    bundlePackages.find(
      (bundlePackage) => bundlePackage.id === activeBundlePackageId,
    ) ??
    bundlePackages.find(
      (bundlePackage) => bundlePackage.resourceType === targetResource,
    );
  const generatedCode = useMemo(
    () =>
      InteropEngine.generatePipelineCode({
        pipelineName: editorPipelineName,
        rules,
        resourceType: targetResource,
        sourceFormat,
        target: codegenTarget,
      }),
    [codegenTarget, editorPipelineName, rules, sourceFormat, targetResource],
  );
  const integrationPackage = useMemo(
    () =>
      InteropEngine.generateIntegrationPackage({
        pipelineName: editorPipelineName,
        rules,
        resourceType: targetResource,
        sourceFormat,
        target: codegenTarget,
        sampleInput: rawInput,
      }),
    [codegenTarget, editorPipelineName, rawInput, rules, sourceFormat, targetResource],
  );
  const integrationBundle = useMemo(
    () =>
      InteropEngine.generateIntegrationBundle({
        bundleName,
        packages: bundlePackages,
      }),
    [bundleName, bundlePackages],
  );
  const bundleManifestFile =
    integrationBundle.files.find((file) => file.path === "interopmed-bundle.json") ??
    integrationBundle.files[0];
  const savedCurrentBundlePackage = activeSavedBundlePackage;
  const currentBundlePackage = useMemo(
    () =>
      buildPackageDraft(
        targetResource,
        sourceFormat,
        codegenTarget,
        rules,
        rawInput,
        {
          id:
            savedCurrentBundlePackage?.id ??
            activeBundlePackageId ??
            defaultBundlePackageId(targetResource),
          displayName: savedCurrentBundlePackage?.displayName,
          pipelineName: editorPipelineName,
        },
      ),
    [
      activeBundlePackageId,
      codegenTarget,
      rawInput,
      rules,
      savedCurrentBundlePackage?.displayName,
      savedCurrentBundlePackage?.id,
      editorPipelineName,
      sourceFormat,
      targetResource,
    ],
  );
  const currentPackageInBundle = savedCurrentBundlePackage !== undefined;
  const currentPackageSavedInBundle =
    savedCurrentBundlePackage !== undefined &&
    bundlePackageSignature(savedCurrentBundlePackage) ===
      bundlePackageSignature(currentBundlePackage);
  const currentPackageBundleStatus = currentPackageSavedInBundle
    ? "Saved in bundle"
    : currentPackageInBundle
      ? "Unsaved bundle changes"
      : "Not in bundle";
  const [activePackagePath, setActivePackagePath] = useState("mapping.json");
  const activePackageFile =
    integrationPackage.files.find((file) => file.path === activePackagePath) ??
    integrationPackage.files[0];
  const filteredRules = useMemo(
    () => filterRules(rules, ruleFilter),
    [ruleFilter, rules],
  );

  const appliedCount = transformResult?.appliedRuleCount ?? 0;
  const errorCount = allIssues.filter((issue) => issue.severity === "error").length;
  const warningCount = allIssues.filter((issue) => issue.severity === "warning").length;
  const fhirCompatible = transformResult?.fhirCompatible === true;
  const industryReady =
    fhirCompatible &&
    pipelineResult.execution.persistedPhi === false &&
    pipelineResult.execution.externalTelemetry === false;

  function loadResource(resourceType: SupportedFhirResourceType): void {
    const resourceModule = getResourceModule(resourceType);
    const nextFormat =
      resourceModule.hl7Rules !== undefined ? sourceFormat : "json";

    setTargetResource(resourceType);
    setSourceFormat(nextFormat);
    setEditorPipelineName(defaultPipelineName(nextFormat, resourceType));
    setRawInput(sampleFor(resourceModule, nextFormat));
    setRules([...rulesFor(resourceModule, nextFormat)]);
    setActiveBundlePackageId(defaultBundlePackageId(resourceType));
    setRuleFilter("");
  }

  function loadFormat(format: SourceFormat): void {
    setSourceFormat(format);
    setEditorPipelineName(defaultPipelineName(format, targetResource));
    setRawInput(sampleFor(selectedModule, format));
    setRules([...rulesFor(selectedModule, format)]);
    setActiveBundlePackageId(defaultBundlePackageId(targetResource));
    setRuleFilter("");
  }

  function updateRule(
    ruleId: string,
    field: keyof Pick<MappingRule, "sourcePath" | "targetPath" | "transform">,
    value: string,
  ): void {
    setRules((currentRules) =>
      currentRules.map((rule) =>
        rule.id === ruleId
          ? { ...rule, [field]: field === "transform" ? (value as TransformName) : value }
          : rule,
      ),
    );
  }

  function toggleRequired(ruleId: string): void {
    setRules((currentRules) =>
      currentRules.map((rule) =>
        rule.id === ruleId ? { ...rule, required: !rule.required } : rule,
      ),
    );
  }

  function downloadIntegrationPackage(): void {
    const zipBlob = createZipBlob(
      integrationPackage.files.map((file) => ({
        path: `${integrationPackage.packageName}/${file.path}`,
        content: file.content,
      })),
    );
    const url = URL.createObjectURL(zipBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${integrationPackage.packageName}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function copyPackageFile(): Promise<void> {
    await navigator.clipboard.writeText(activePackageFile.content);
    setCopiedPackagePath(activePackageFile.path);
    window.setTimeout(() => setCopiedPackagePath(null), 1500);
  }

  async function copyBundleManifest(): Promise<void> {
    await navigator.clipboard.writeText(bundleManifestFile.content);
    setCopiedBundleManifest(true);
    window.setTimeout(() => setCopiedBundleManifest(false), 1500);
  }

  function downloadIntegrationBundle(): void {
    const zipBlob = createZipBlob(
      integrationBundle.files.map((file) => ({
        path: `${integrationBundle.bundleName}/${file.path}`,
        content: file.content,
      })),
    );
    const url = URL.createObjectURL(zipBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${integrationBundle.bundleName}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function addBundleResource(resourceType: SupportedFhirResourceType): void {
    setBundlePackages((currentPackages) =>
      currentPackages.some((bundlePackage) => bundlePackage.resourceType === resourceType)
        ? currentPackages
        : [
            ...currentPackages,
            createDefaultBundlePackage(resourceType, sourceFormat, codegenTarget),
          ],
    );
  }

  function applyWorkflowTemplate(templateId: string): void {
    const template = workflowTemplates.find((candidate) => candidate.id === templateId);
    if (template === undefined) {
      return;
    }

    const templatePackages = template.resources.map((resourceType) =>
      createDefaultBundlePackage(resourceType, sourceFormat, codegenTarget),
    );

    setBundleName(`${template.label} Bundle`);
    setBundlePackages(templatePackages);
    loadBundlePackage(templatePackages[0]);
    setImportStatus(`Loaded ${template.label} template.`);
  }

  function removeBundleResource(packageId: string): void {
    if (bundlePackages.length === 1) {
      return;
    }

    const nextPackages = bundlePackages.filter(
      (bundlePackage) => bundlePackage.id !== packageId,
    );

    setBundlePackages(nextPackages);

    if (packageId === activeBundlePackageId) {
      if (nextPackages[0] !== undefined) {
        loadBundlePackage(nextPackages[0]);
      } else {
        setActiveBundlePackageId(defaultBundlePackageId(targetResource));
      }
    }
  }

  function saveCurrentPackageToBundle(): void {
    setBundlePackages((currentPackages) => {
      const packageIndex = currentPackages.findIndex(
        (bundlePackage) => bundlePackage.id === currentBundlePackage.id,
      );

      if (packageIndex === -1) {
        return [...currentPackages, currentBundlePackage];
      }

      return currentPackages.map((bundlePackage, index) =>
        index === packageIndex ? currentBundlePackage : bundlePackage,
      );
    });
    setActiveBundlePackageId(currentBundlePackage.id);
  }

  function loadBundlePackage(bundlePackage: BundlePackageDraft): void {
    setActiveBundlePackageId(bundlePackage.id);
    setTargetResource(bundlePackage.resourceType);
    setSourceFormat(bundlePackage.sourceFormat);
    setCodegenTarget(bundlePackage.target);
    setEditorPipelineName(bundlePackage.pipelineName);
    setRawInput(bundlePackage.sampleInput);
    setRules([...bundlePackage.rules]);
    setRuleFilter("");
  }

  async function importInteropmedArtifact(file: File): Promise<void> {
    try {
      const content = await file.text();
      const artifact = JSON.parse(content) as unknown;
      const importedPackages = importedPackagesFromArtifact(
        artifact,
        codegenTarget,
      );

      if (importedPackages.length === 0) {
        setImportStatus("No importable InteropMed package data found.");
        return;
      }

      setBundlePackages((currentPackages) =>
        mergeBundlePackages(currentPackages, importedPackages),
      );
      loadBundlePackage(importedPackages[0]);
      setImportStatus(
        importedPackages.length === 1
          ? `Imported ${importedPackages[0].displayName}.`
          : `Imported ${importedPackages.length} bundle packages.`,
      );
    } catch (error) {
      setImportStatus(
        error instanceof Error ? error.message : "Could not import artifact.",
      );
    }
  }

  async function runExternalValidation(): Promise<void> {
    if (externalValidatorUrl.trim().length === 0) {
      setExternalValidationStatus("Enter a validator endpoint.");
      return;
    }

    if (transformResult?.output === undefined || transformResult.output === null) {
      setExternalValidationStatus("No FHIR output to validate.");
      return;
    }

    setExternalValidationRunning(true);
    setExternalValidationStatus("Running external validation...");

    try {
      const response = await fetch(externalValidatorUrl.trim(), {
        method: "POST",
        headers: {
          Accept: "application/fhir+json, application/json, text/plain",
          "Content-Type": "application/fhir+json",
        },
        body: JSON.stringify(transformResult.output),
      });
      const contentType = response.headers.get("content-type") ?? "";
      const result = contentType.includes("json")
        ? await response.json()
        : await response.text();

      setExternalValidationResult(result);
      setExternalValidationStatus(
        response.ok
          ? "External validator returned a response."
          : `External validator returned HTTP ${response.status}.`,
      );
    } catch (error) {
      setExternalValidationResult(null);
      setExternalValidationStatus(
        error instanceof Error
          ? error.message
          : "External validation request failed.",
      );
    } finally {
      setExternalValidationRunning(false);
    }
  }

  function duplicateBundlePackage(bundlePackage: BundlePackageDraft): void {
    const duplicatedPackage = duplicateBundlePackageDraft(
      bundlePackage,
      bundlePackages,
    );

    setBundlePackages((currentPackages) => [
      ...currentPackages,
      duplicatedPackage,
    ]);
    loadBundlePackage(duplicatedPackage);
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1760px] flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <h1 className="text-xl font-semibold">InteropMed Studio</h1>
            <p className="text-sm text-slate-600">
              Advanced in-browser mapping to FHIR R4 resources.
            </p>
          </div>
          <div className="flex items-center gap-2 border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-900">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Stateless execution
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1760px] grid-cols-1 gap-4 px-5 py-5 2xl:grid-cols-[430px_minmax(600px,1fr)_470px]">
        <Panel title="Source intake" icon={<FileJson className="h-4 w-4" />}>
          <div className="mb-3">
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Target resource
            </label>
            <select
              className="h-9 w-full border border-slate-300 bg-white px-2 text-sm outline-none focus:border-teal-600"
              value={targetResource}
              onChange={(event) =>
                loadResource(event.target.value as SupportedFhirResourceType)
              }
            >
              {resourceModules.map((resourceModule) => (
                <option
                  key={resourceModule.resourceType}
                  value={resourceModule.resourceType}
                >
                  {resourceModule.resourceType}
                </option>
              ))}
            </select>
          </div>
          <SegmentedControl
            values={availableSourceFormats}
            active={sourceFormat}
            onChange={loadFormat}
            labels={{ json: "JSON", hl7v2: "HL7 v2" }}
          />
          <div className="mt-3">
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              FHIR version
            </label>
            <SegmentedControl
              values={fhirVersions}
              active={fhirVersion}
              onChange={setFhirVersion}
              labels={{ R4: "R4 stable", "R5-preview": "R5 preview" }}
            />
            {fhirVersion === "R5-preview" ? (
              <div className="mt-2 border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-950">
                R5 preview is for planning only. Package generation remains R4.
              </div>
            ) : null}
          </div>
          <textarea
            className="mt-3 h-[270px] w-full resize-none border border-slate-300 bg-slate-950 p-3 font-mono text-sm text-emerald-200 outline-none focus:border-teal-600"
            value={rawInput}
            spellCheck={false}
            onChange={(event) => setRawInput(event.target.value)}
          />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric label="Applied" value={`${appliedCount}/${rules.length}`} tone="teal" />
            <Metric label="Errors" value={String(errorCount)} tone="rose" />
            <Metric label="Warnings" value={String(warningCount)} tone="amber" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric
              label="FHIR"
              value={fhirCompatible ? "Pass" : "Hold"}
              tone={fhirCompatible ? "teal" : "rose"}
            />
            <Metric label="Validator" value="Profile" tone="teal" />
            <Metric label="PHI Store" value="None" tone="teal" />
          </div>
          <div
            className={`mt-3 flex items-center gap-2 border px-3 py-2 text-sm ${
              fhirCompatible
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
            }`}
          >
            {fhirCompatible ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            )}
            {fhirCompatible
              ? "FHIR R4 Patient compatibility checks passed."
              : "FHIR R4 compatibility checks need attention."}
          </div>
          <IssueList issues={allIssues} />
        </Panel>

        <div className="space-y-4">
          <Panel title="Bundle assembly" icon={<Download className="h-4 w-4" />}>
            <BundleAssembly
              bundleName={bundleName}
              packageCount={integrationBundle.packages.length}
              fileCount={integrationBundle.files.length}
              manifestFile={bundleManifestFile}
              copiedManifest={copiedBundleManifest}
              importStatus={importStatus}
              bundleResourceToAdd={bundleResourceToAdd}
              bundlePackages={bundlePackages}
              onAddBundleResource={addBundleResource}
              onBundleNameChange={setBundleName}
              onBundleResourceToAddChange={setBundleResourceToAdd}
              onCopyManifest={copyBundleManifest}
              onDuplicateBundlePackage={duplicateBundlePackage}
              onDownloadIntegrationBundle={downloadIntegrationBundle}
              onImportArtifact={importInteropmedArtifact}
              onLoadBundlePackage={loadBundlePackage}
              onWorkflowTemplateChange={applyWorkflowTemplate}
              onRemoveBundleResource={removeBundleResource}
            />
          </Panel>

          <Panel title="Rule matrix" icon={<Layers3 className="h-4 w-4" />}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <input
                className="h-9 min-w-[220px] flex-1 border border-slate-300 bg-white px-2 text-sm outline-none focus:border-teal-600"
                placeholder="Search label, source, target, transform"
                type="search"
                value={ruleFilter}
                onChange={(event) => setRuleFilter(event.target.value)}
              />
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="border border-slate-200 bg-slate-50 px-2 py-1">
                  {filteredRules.length}/{rules.length} rules
                </span>
                {ruleFilter.trim().length > 0 ? (
                  <button
                    className="h-8 border border-slate-300 bg-white px-2 font-semibold text-slate-700 hover:bg-slate-50"
                    type="button"
                    onClick={() => setRuleFilter("")}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                    <th className="py-2 pr-2">Rule</th>
                    <th className="px-2 py-2">Source path</th>
                    <th className="px-2 py-2">Target path</th>
                    <th className="px-2 py-2">Transform</th>
                    <th className="py-2 pl-2">Req</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRules.map((rule) => (
                    <tr key={rule.id} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-2 font-medium text-slate-800">{rule.label}</td>
                      <td className="px-2 py-2">
                        <PathInput
                          value={rule.sourcePath}
                          onChange={(value) => updateRule(rule.id, "sourcePath", value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <PathInput
                          value={rule.targetPath}
                          onChange={(value) => updateRule(rule.id, "targetPath", value)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          className="h-9 w-full border border-slate-300 bg-white px-2 text-xs outline-none focus:border-teal-600"
                          value={rule.transform ?? "none"}
                          onChange={(event) =>
                            updateRule(rule.id, "transform", event.target.value)
                          }
                        >
                          {transforms.map((transform) => (
                            <option key={transform} value={transform}>
                              {transform}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pl-2">
                        <input
                          aria-label={`${rule.label} required`}
                          checked={rule.required === true}
                          className="h-4 w-4 accent-teal-700"
                          type="checkbox"
                          onChange={() => toggleRequired(rule.id)}
                        />
                      </td>
                    </tr>
                  ))}
                  {filteredRules.length === 0 ? (
                    <tr>
                      <td
                        className="py-6 text-center text-sm text-slate-500"
                        colSpan={5}
                      >
                        No matching rules
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Export handoff" icon={<Download className="h-4 w-4" />}>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                Package pipeline name
              </label>
              <input
                className="h-9 w-full border border-slate-300 bg-white px-2 text-sm outline-none focus:border-teal-600"
                value={editorPipelineName}
                onChange={(event) => setEditorPipelineName(event.target.value)}
              />
            </div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  {integrationPackage.packageName}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="border border-slate-200 bg-slate-50 px-2 py-1">
                    {integrationPackage.files.length} files
                  </span>
                  <span className="border border-slate-200 bg-slate-50 px-2 py-1">
                    {targetResource}
                  </span>
                  <span className="border border-slate-200 bg-slate-50 px-2 py-1">
                    {codegenTarget}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  type="button"
                  onClick={copyPackageFile}
                >
                  {copiedPackagePath === activePackageFile.path ? (
                    <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {copiedPackagePath === activePackageFile.path ? "Copied" : "Copy"}
                </button>
                <button
                  className="flex h-9 items-center gap-2 border border-teal-700 bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800"
                  type="button"
                  onClick={downloadIntegrationPackage}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  ZIP
                </button>
              </div>
            </div>
            <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs font-semibold text-slate-600">
              <div
                className={`flex items-center gap-2 border px-2 py-2 ${
                  currentPackageSavedInBundle
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : currentPackageInBundle
                      ? "border-amber-200 bg-amber-50 text-amber-950"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                {currentPackageSavedInBundle ? (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {currentPackageBundleStatus}
              </div>
              <GitBranch className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <button
                className="border border-slate-300 bg-white px-2 py-2 text-left text-slate-700 hover:border-teal-600 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={currentPackageSavedInBundle}
                type="button"
                onClick={saveCurrentPackageToBundle}
              >
                {currentPackageInBundle ? "Update in bundle" : "Add to bundle"}
              </button>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {integrationPackage.files.map((file) => (
                <button
                  key={file.path}
                  className={`border px-2 py-1 text-xs font-semibold ${
                    activePackageFile.path === file.path
                      ? "border-teal-700 bg-teal-700 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  type="button"
                  onClick={() => setActivePackagePath(file.path)}
                >
                  {file.path}
                </button>
              ))}
            </div>
            <PackageFileBlock file={activePackageFile} />
          </Panel>

          <Panel title="Pipeline code" icon={<Code2 className="h-4 w-4" />}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <SegmentedControl
                values={codegenTargets}
                active={codegenTarget}
                onChange={setCodegenTarget}
                labels={{ typescript: "TS", python: "Python", node: "Node" }}
              />
              <button
                className="flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                type="button"
                onClick={() => loadFormat(sourceFormat)}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Reset
              </button>
            </div>
            <pre className="h-[260px] overflow-auto border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-amber-100">
              {generatedCode}
            </pre>
          </Panel>

          <Panel title={`FHIR R4 ${targetResource}`} icon={<CheckCircle2 className="h-4 w-4" />}>
            <JsonBlock value={transformResult?.output ?? {}} height="h-[260px]" />
          </Panel>

          <Panel title="Validation" icon={<ShieldCheck className="h-4 w-4" />}>
            <div
              className={`mb-3 border px-3 py-2 text-sm ${
                industryReady
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-amber-200 bg-amber-50 text-amber-950"
              }`}
            >
              {industryReady
                ? "Pipeline contract is ready for generated implementation review."
                : "Resolve compatibility errors before treating generated code as implementation-ready."}
            </div>
            <div className="mb-3 border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Validator: {pipelineResult.profileValidation?.validator ?? "none"} /{" "}
              {pipelineResult.profileValidation?.profileUrl ?? "no profile"}
            </div>
            <div className="mb-3 grid gap-2">
              <label className="block text-xs font-semibold uppercase text-slate-500">
                External validator endpoint
              </label>
              <div className="flex gap-2">
                <input
                  className="h-9 min-w-0 flex-1 border border-slate-300 bg-white px-2 text-sm outline-none focus:border-teal-600"
                  placeholder="https://validator.example/fhir/Resource/$validate"
                  value={externalValidatorUrl}
                  onChange={(event) => setExternalValidatorUrl(event.target.value)}
                />
                <button
                  className="h-9 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={externalValidationRunning}
                  type="button"
                  onClick={runExternalValidation}
                >
                  {externalValidationRunning ? "Running" : "Validate"}
                </button>
              </div>
              <div className="text-xs text-slate-600">{externalValidationStatus}</div>
            </div>
            <JsonBlock value={pipelineResult.operationOutcome} height="h-[190px]" />
            {externalValidationResult !== null ? (
              <div className="mt-3">
                <JsonBlock value={externalValidationResult} height="h-[190px]" />
              </div>
            ) : null}
          </Panel>

          <Panel title="Normalized source" icon={<Braces className="h-4 w-4" />}>
            <JsonBlock value={parsed.payload ?? {}} height="h-[190px]" />
          </Panel>
        </div>
      </section>
    </main>
  );
}

function Panel({
  title,
  icon,
  children,
}: Readonly<{ title: string; icon: ReactNode; children: ReactNode }>) {
  return (
    <section className="border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function SegmentedControl<TValue extends string>({
  values,
  active,
  labels,
  onChange,
}: Readonly<{
  values: readonly TValue[];
  active: TValue;
  labels: Record<TValue, string>;
  onChange: (value: TValue) => void;
}>) {
  return (
    <div className="inline-flex border border-slate-300 bg-white p-1">
      {values.map((value) => (
        <button
          key={value}
          className={`h-8 px-3 text-xs font-semibold ${
            active === value
              ? "bg-teal-700 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
          type="button"
          onClick={() => onChange(value)}
        >
          {labels[value]}
        </button>
      ))}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: Readonly<{ label: string; value: string; tone: "teal" | "rose" | "amber" }>) {
  const toneClass = {
    teal: "border-teal-200 bg-teal-50 text-teal-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
  }[tone];

  return (
    <div className={`border px-3 py-2 ${toneClass}`}>
      <div className="text-xs font-medium">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function IssueList({ issues }: Readonly<{ issues: readonly TransformIssue[] }>) {
  if (issues.length === 0) {
    return (
      <div className="mt-3 flex items-center gap-2 border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        No parser or mapping issues detected.
      </div>
    );
  }

  return (
    <ul className="mt-3 space-y-2 text-sm">
      {issues.map((issue) => (
        <li
          key={`${issue.ruleId}-${issue.message}`}
          className={`flex gap-2 border px-3 py-2 ${
            issue.severity === "error"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}

function PathInput({
  value,
  onChange,
}: Readonly<{ value: string; onChange: (value: string) => void }>) {
  return (
    <input
      className="h-9 w-full border border-slate-300 bg-white px-2 font-mono text-xs outline-none focus:border-teal-600"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function JsonBlock({
  value,
  height,
}: Readonly<{ value: unknown; height: string }>) {
  return (
    <pre
      className={`${height} overflow-auto border border-slate-300 bg-white p-3 font-mono text-xs text-slate-800`}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function PackageFileBlock({ file }: Readonly<{ file: IntegrationPackageFile }>) {
  return (
    <pre className="h-[310px] overflow-auto border border-slate-300 bg-slate-950 p-3 font-mono text-xs text-sky-100">
      <code>{file.content}</code>
    </pre>
  );
}

function BundleAssembly({
  bundleName,
  packageCount,
  fileCount,
  manifestFile,
  copiedManifest,
  importStatus,
  bundleResourceToAdd,
  bundlePackages,
  onAddBundleResource,
  onBundleNameChange,
  onBundleResourceToAddChange,
  onCopyManifest,
  onDuplicateBundlePackage,
  onDownloadIntegrationBundle,
  onImportArtifact,
  onLoadBundlePackage,
  onWorkflowTemplateChange,
  onRemoveBundleResource,
}: Readonly<{
  bundleName: string;
  packageCount: number;
  fileCount: number;
  manifestFile: IntegrationPackageFile;
  copiedManifest: boolean;
  importStatus: string | null;
  bundleResourceToAdd: SupportedFhirResourceType;
  bundlePackages: readonly BundlePackageDraft[];
  onAddBundleResource: (resourceType: SupportedFhirResourceType) => void;
  onBundleNameChange: (bundleName: string) => void;
  onBundleResourceToAddChange: (resourceType: SupportedFhirResourceType) => void;
  onCopyManifest: () => void;
  onDuplicateBundlePackage: (bundlePackage: BundlePackageDraft) => void;
  onDownloadIntegrationBundle: () => void;
  onImportArtifact: (file: File) => void;
  onLoadBundlePackage: (bundlePackage: BundlePackageDraft) => void;
  onWorkflowTemplateChange: (templateId: string) => void;
  onRemoveBundleResource: (packageId: string) => void;
}>) {
  return (
    <>
      <div className="mb-3">
        <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
          Bundle name
        </label>
        <input
          className="h-9 w-full border border-slate-300 bg-white px-2 text-sm outline-none focus:border-teal-600"
          value={bundleName}
          onChange={(event) => onBundleNameChange(event.target.value)}
        />
      </div>
      <div className="mb-3">
        <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
          Workflow template
        </label>
        <select
          className="h-9 w-full border border-slate-300 bg-white px-2 text-sm outline-none focus:border-teal-600"
          defaultValue=""
          onChange={(event) => {
            if (event.target.value.length > 0) {
              onWorkflowTemplateChange(event.target.value);
              event.target.value = "";
            }
          }}
        >
          <option value="">Choose template</option>
          {workflowTemplates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="border border-slate-200 bg-slate-50 px-2 py-1">
            {packageCount} packages
          </span>
          <span className="border border-slate-200 bg-slate-50 px-2 py-1">
            {fileCount} files
          </span>
          <span className="border border-slate-200 bg-slate-50 px-2 py-1">
            manifest included
          </span>
        </div>
        <button
          className="flex h-9 items-center gap-2 border border-teal-700 bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800"
          type="button"
          onClick={onDownloadIntegrationBundle}
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Bundle ZIP
        </button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex h-9 cursor-pointer items-center gap-2 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
          Import JSON
          <input
            accept=".json,application/json"
            className="sr-only"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file !== undefined) {
                onImportArtifact(file);
              }
              event.target.value = "";
            }}
          />
        </label>
        {importStatus !== null ? (
          <span className="text-xs text-slate-600">{importStatus}</span>
        ) : null}
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs font-semibold text-slate-600">
        <div className="border border-slate-200 bg-slate-50 px-2 py-2">
          1. Select resource
        </div>
        <div className="border border-slate-200 bg-slate-50 px-2 py-2">
          2. Edit package
        </div>
        <div className="border border-slate-200 bg-slate-50 px-2 py-2">
          3. Save to bundle
        </div>
      </div>
      <div className="mb-3 flex gap-2">
        <select
          className="h-9 min-w-0 flex-1 border border-slate-300 bg-white px-2 text-sm outline-none focus:border-teal-600"
          value={bundleResourceToAdd}
          onChange={(event) =>
            onBundleResourceToAddChange(
              event.target.value as SupportedFhirResourceType,
            )
          }
        >
          {resourceModules.map((resourceModule) => (
            <option
              key={resourceModule.resourceType}
              value={resourceModule.resourceType}
            >
              {resourceModule.resourceType}
            </option>
          ))}
        </select>
        <button
          className="h-9 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          type="button"
          onClick={() => onAddBundleResource(bundleResourceToAdd)}
        >
          Add
        </button>
      </div>
      <div className="overflow-x-auto border border-slate-200">
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-2 py-2">Resource</th>
              <th className="px-2 py-2">Source</th>
              <th className="px-2 py-2">Target</th>
              <th className="px-2 py-2">Rules</th>
              <th className="px-2 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bundlePackages.map((bundlePackage) => (
              <tr
                key={bundlePackage.id}
                className="border-b border-slate-100 last:border-b-0"
              >
                <td className="px-2 py-2">
                  <button
                    className="max-w-[180px] truncate text-left text-sm font-semibold text-slate-800 hover:text-teal-800"
                    type="button"
                    onClick={() => onLoadBundlePackage(bundlePackage)}
                  >
                    {bundlePackage.displayName}
                  </button>
                  <div className="text-[11px] text-slate-500">
                    {bundlePackage.resourceType}
                  </div>
                </td>
                <td className="px-2 py-2 text-xs text-slate-600">
                  {bundlePackage.sourceFormat}
                </td>
                <td className="px-2 py-2 text-xs text-slate-600">
                  {bundlePackage.target}
                </td>
                <td className="px-2 py-2 text-xs text-slate-600">
                  {bundlePackage.rules.length}
                </td>
                <td className="px-2 py-2">
                  <div className="flex justify-end gap-1">
                    <button
                      className="h-8 border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      type="button"
                      onClick={() => onLoadBundlePackage(bundlePackage)}
                    >
                      Edit
                    </button>
                    <button
                      className="h-8 border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      type="button"
                      onClick={() => onDuplicateBundlePackage(bundlePackage)}
                    >
                      Duplicate
                    </button>
                    <button
                      className="h-8 border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={bundlePackages.length === 1}
                      type="button"
                      onClick={() => onRemoveBundleResource(bundlePackage.id)}
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 border border-slate-200">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-2 py-2">
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-slate-800">
              {manifestFile.path}
            </div>
            <div className="text-[11px] text-slate-500">Bundle manifest preview</div>
          </div>
          <button
            className="flex h-8 items-center gap-1.5 border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            type="button"
            onClick={onCopyManifest}
          >
            {copiedManifest ? (
              <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {copiedManifest ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="max-h-[170px] overflow-auto bg-slate-950 p-3 font-mono text-xs text-sky-100">
          <code>{manifestFile.content}</code>
        </pre>
      </div>
    </>
  );
}

function createDefaultBundlePackage(
  resourceType: SupportedFhirResourceType,
  preferredSourceFormat: SourceFormat,
  target: CodegenTarget,
): BundlePackageDraft {
  const resourceModule = getResourceModule(resourceType);
  const sourceFormat = sourceFormatsFor(resourceModule).includes(preferredSourceFormat)
    ? preferredSourceFormat
    : "json";

  return buildPackageDraft(
    resourceType,
    sourceFormat,
    target,
    rulesFor(resourceModule, sourceFormat),
    sampleFor(resourceModule, sourceFormat),
  );
}

function buildPackageDraft(
  resourceType: SupportedFhirResourceType,
  sourceFormat: SourceFormat,
  target: CodegenTarget,
  rules: readonly MappingRule[],
  sampleInput: string,
  options: Readonly<{
    id?: string;
    displayName?: string;
    pipelineName?: string;
  }> = {},
): BundlePackageDraft {
  return {
    id: options.id ?? defaultBundlePackageId(resourceType),
    displayName: options.displayName ?? resourceType,
    pipelineName: options.pipelineName ?? defaultPipelineName(sourceFormat, resourceType),
    rules: [...rules],
    resourceType,
    sourceFormat,
    target,
    sampleInput,
  };
}

function defaultPipelineName(
  sourceFormat: SourceFormat,
  resourceType: SupportedFhirResourceType,
): string {
  return `${sourceFormat} ${resourceType} Pipeline`;
}

function defaultBundlePackageId(resourceType: SupportedFhirResourceType): string {
  return toPackageVariantId(resourceType);
}

function duplicateBundlePackageDraft(
  bundlePackage: BundlePackageDraft,
  bundlePackages: readonly BundlePackageDraft[],
): BundlePackageDraft {
  const variantNumber =
    bundlePackages.filter(
      (candidate) => candidate.resourceType === bundlePackage.resourceType,
    ).length + 1;
  const displayName = `${bundlePackage.resourceType} Variant ${variantNumber}`;

  return {
    ...bundlePackage,
    id: uniqueBundlePackageId(
      toPackageVariantId(displayName),
      bundlePackages,
    ),
    displayName,
    pipelineName: `${bundlePackage.pipelineName} Variant ${variantNumber}`,
    rules: [...bundlePackage.rules],
  };
}

function importedPackagesFromArtifact(
  artifact: unknown,
  fallbackTarget: CodegenTarget,
): BundlePackageDraft[] {
  if (!isPlainObject(artifact) || typeof artifact.schemaVersion !== "string") {
    throw new Error("Imported JSON is not an InteropMed artifact.");
  }

  if (artifact.schemaVersion === "interopmed.mapping.v1") {
    return [bundlePackageFromMapping(artifact, fallbackTarget)];
  }

  if (artifact.schemaVersion === "interopmed.package.v1") {
    return [bundlePackageFromPackageManifest(artifact)];
  }

  if (artifact.schemaVersion === "interopmed.bundle.v1") {
    return bundlePackagesFromBundleManifest(artifact);
  }

  throw new Error(`Unsupported InteropMed artifact: ${artifact.schemaVersion}`);
}

function bundlePackageFromMapping(
  mapping: Record<string, unknown>,
  fallbackTarget: CodegenTarget,
): BundlePackageDraft {
  const resourceType = resourceTypeFromMappingTarget(mapping.target);
  const sourceFormat = sourceFormatFromUnknown(mapping.sourceFormat);
  const resourceModule = getResourceModule(resourceType);
  const rules = Array.isArray(mapping.rules)
    ? (mapping.rules as MappingRule[])
    : rulesFor(resourceModule, sourceFormat);
  const pipelineName =
    typeof mapping.name === "string"
      ? mapping.name
      : defaultPipelineName(sourceFormat, resourceType);

  return buildPackageDraft(
    resourceType,
    sourceFormat,
    fallbackTarget,
    rules,
    sampleFor(resourceModule, sourceFormat),
    {
      id: uniqueBundlePackageId(toPackageVariantId(pipelineName), []),
      displayName: resourceType,
      pipelineName,
    },
  );
}

function bundlePackageFromPackageManifest(
  manifest: Record<string, unknown>,
): BundlePackageDraft {
  const resourceType = resourceTypeFromUnknown(manifest.resourceType);
  const sourceFormat = sourceFormatFromUnknown(manifest.sourceFormat);
  const target = codegenTargetFromUnknown(manifest.target);
  const resourceModule = getResourceModule(resourceType);
  const pipelineName =
    typeof manifest.pipelineName === "string"
      ? manifest.pipelineName
      : defaultPipelineName(sourceFormat, resourceType);

  return buildPackageDraft(
    resourceType,
    sourceFormat,
    target,
    rulesFor(resourceModule, sourceFormat),
    sampleFor(resourceModule, sourceFormat),
    {
      id: uniqueBundlePackageId(toPackageVariantId(pipelineName), []),
      displayName:
        typeof manifest.packageName === "string"
          ? manifest.packageName
          : resourceType,
      pipelineName,
    },
  );
}

function bundlePackagesFromBundleManifest(
  manifest: Record<string, unknown>,
): BundlePackageDraft[] {
  const resources = Array.isArray(manifest.resources) ? manifest.resources : [];

  return resources
    .filter(isPlainObject)
    .map((entry, index) => {
      const resourceType = resourceTypeFromUnknown(entry.resourceType);
      const sourceFormat = sourceFormatFromUnknown(entry.sourceFormat);
      const target = codegenTargetFromUnknown(entry.target);
      const resourceModule = getResourceModule(resourceType);
      const displayName =
        typeof entry.packageName === "string" ? entry.packageName : resourceType;

      return buildPackageDraft(
        resourceType,
        sourceFormat,
        target,
        rulesFor(resourceModule, sourceFormat),
        sampleFor(resourceModule, sourceFormat),
        {
          id: `${toPackageVariantId(displayName)}-${index + 1}`,
          displayName,
          pipelineName: defaultPipelineName(sourceFormat, resourceType),
        },
      );
    });
}

function mergeBundlePackages(
  currentPackages: readonly BundlePackageDraft[],
  importedPackages: readonly BundlePackageDraft[],
): BundlePackageDraft[] {
  return [
    ...currentPackages,
    ...importedPackages.map((bundlePackage) => ({
      ...bundlePackage,
      id: uniqueBundlePackageId(bundlePackage.id, currentPackages),
    })),
  ];
}

function uniqueBundlePackageId(
  preferredId: string,
  bundlePackages: readonly BundlePackageDraft[],
): string {
  const existingIds = new Set(bundlePackages.map((bundlePackage) => bundlePackage.id));

  if (!existingIds.has(preferredId)) {
    return preferredId;
  }

  let suffix = 2;
  let candidate = `${preferredId}-${suffix}`;

  while (existingIds.has(candidate)) {
    suffix += 1;
    candidate = `${preferredId}-${suffix}`;
  }

  return candidate;
}

function resourceTypeFromMappingTarget(value: unknown): SupportedFhirResourceType {
  if (typeof value === "string") {
    const [, resourceType] = value.match(/^FHIR_R4_(.+)$/) ?? [];
    return resourceTypeFromUnknown(resourceType);
  }

  return "Patient";
}

function resourceTypeFromUnknown(value: unknown): SupportedFhirResourceType {
  if (typeof value === "string" && isFhirR4ResourceType(value)) {
    return value;
  }

  return "Patient";
}

function sourceFormatFromUnknown(value: unknown): SourceFormat {
  return value === "hl7v2" ? "hl7v2" : "json";
}

function codegenTargetFromUnknown(value: unknown): CodegenTarget {
  if (value === "python" || value === "node") {
    return value;
  }

  return "typescript";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPackageVariantId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function bundlePackageSignature(bundlePackage: BundlePackageDraft): string {
  return JSON.stringify({
    id: bundlePackage.id,
    displayName: bundlePackage.displayName,
    pipelineName: bundlePackage.pipelineName,
    rules: bundlePackage.rules,
    resourceType: bundlePackage.resourceType,
    sourceFormat: bundlePackage.sourceFormat,
    target: bundlePackage.target,
    sampleInput: bundlePackage.sampleInput,
  });
}

function filterRules(
  rules: readonly MappingRule[],
  filter: string,
): readonly MappingRule[] {
  const terms = filter
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) {
    return rules;
  }

  return rules.filter((rule) => {
    const searchableText = [
      rule.label,
      rule.sourcePath,
      rule.targetPath,
      rule.transform ?? "none",
      rule.required === true ? "required" : "optional",
    ]
      .join(" ")
      .toLowerCase();

    return terms.every((term) => searchableText.includes(term));
  });
}

function sourceFormatsFor(
  resourceModule: ResourceModule,
): readonly SourceFormat[] {
  return resourceModule.hl7Rules === undefined ? ["json"] : ["json", "hl7v2"];
}

function sampleFor(
  resourceModule: ResourceModule,
  sourceFormat: SourceFormat,
): string {
  if (sourceFormat === "hl7v2" && resourceModule.sampleHl7 !== undefined) {
    return resourceModule.sampleHl7;
  }

  return resourceModule.sampleJson;
}

function rulesFor(
  resourceModule: ResourceModule,
  sourceFormat: SourceFormat,
): readonly MappingRule[] {
  if (sourceFormat === "hl7v2" && resourceModule.hl7Rules !== undefined) {
    return resourceModule.hl7Rules;
  }

  return resourceModule.jsonRules;
}

function createZipBlob(
  files: readonly { path: string; content: string }[],
): Blob {
  const encoder = new TextEncoder();
  const localFileRecords: Uint8Array[] = [];
  const centralDirectoryRecords: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.path.replace(/\\/g, "/"));
    const contentBytes = encoder.encode(file.content);
    const crc = crc32(contentBytes);
    const localHeader = createLocalFileHeader(nameBytes, contentBytes, crc);
    const centralHeader = createCentralDirectoryHeader(
      nameBytes,
      contentBytes,
      crc,
      offset,
    );

    localFileRecords.push(localHeader, contentBytes);
    centralDirectoryRecords.push(centralHeader);
    offset += localHeader.length + contentBytes.length;
  });

  const centralDirectoryOffset = offset;
  const centralDirectory = concatBytes(centralDirectoryRecords);
  const endRecord = createEndOfCentralDirectoryRecord(
    files.length,
    centralDirectory.length,
    centralDirectoryOffset,
  );
  const zipBytes = concatBytes([
    ...localFileRecords,
    centralDirectory,
    endRecord,
  ]);

  const zipBuffer = zipBytes.buffer.slice(
    zipBytes.byteOffset,
    zipBytes.byteOffset + zipBytes.byteLength,
  ) as ArrayBuffer;

  return new Blob([zipBuffer], { type: "application/zip" });
}

function createLocalFileHeader(
  nameBytes: Uint8Array,
  contentBytes: Uint8Array,
  crc: number,
): Uint8Array {
  const header = new Uint8Array(30 + nameBytes.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, contentBytes.length, true);
  view.setUint32(22, contentBytes.length, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);
  header.set(nameBytes, 30);

  return header;
}

function createCentralDirectoryHeader(
  nameBytes: Uint8Array,
  contentBytes: Uint8Array,
  crc: number,
  localHeaderOffset: number,
): Uint8Array {
  const header = new Uint8Array(46 + nameBytes.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, contentBytes.length, true);
  view.setUint32(24, contentBytes.length, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, localHeaderOffset, true);
  header.set(nameBytes, 46);

  return header;
}

function createEndOfCentralDirectoryRecord(
  fileCount: number,
  centralDirectorySize: number,
  centralDirectoryOffset: number,
): Uint8Array {
  const record = new Uint8Array(22);
  const view = new DataView(record.buffer);

  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, centralDirectorySize, true);
  view.setUint32(16, centralDirectoryOffset, true);
  view.setUint16(20, 0, true);

  return record;
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });

  return output;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  bytes.forEach((byte) => {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  });

  return (crc ^ 0xffffffff) >>> 0;
}
