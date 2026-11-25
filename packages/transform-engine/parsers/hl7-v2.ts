import type { JsonObject, JsonValue, ParseResult, TransformIssue } from "../core/types";

export function parseHl7v2Payload(rawPayload: string): ParseResult {
  const payload: JsonObject = {};
  const issues: TransformIssue[] = [];
  const lines = unwrapHl7Transport(rawPayload)
    .split(/\r?\n|\r/)
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return {
      payload: null,
      issues: [
        {
          ruleId: "parser",
          severity: "error",
          message: "HL7 v2 input is empty.",
        },
      ],
    };
  }

  const firstSegment = lines[0];
  const separators = parseHl7Separators(firstSegment, issues);
  const segmentCounts: JsonObject = {};
  const segmentOrder: JsonValue[] = [];

  for (const line of lines) {
    const fields = splitHl7SegmentFields(line, separators);
    const segmentName = fields[0];

    if (!/^[A-Z0-9]{3}$/.test(segmentName)) {
      return {
        payload: null,
        issues: [
          ...issues,
          {
            ruleId: "parser",
            severity: "error",
            message: `Invalid HL7 segment name "${segmentName}".`,
          },
        ],
      };
    }

    const parsedFields = normalizeHl7Fields(segmentName, fields, separators).map(
      (field, fieldNumber) => parseHl7Field(segmentName, fieldNumber, field, separators),
    );
    const current = payload[segmentName];

    if (Array.isArray(current)) {
      current.push(parsedFields);
    } else {
      payload[segmentName] = [parsedFields];
    }

    segmentCounts[segmentName] =
      typeof segmentCounts[segmentName] === "number"
        ? segmentCounts[segmentName] + 1
        : 1;
    segmentOrder.push(segmentName);
  }

  payload.__hl7 = createHl7Metadata(payload, separators, segmentOrder, segmentCounts);

  return { payload, issues };
}

function unwrapHl7Transport(rawPayload: string): string {
  return rawPayload
    .replace(/^\u000b/, "")
    .replace(/\u001c\r?$/, "")
    .replace(/\u001c$/, "");
}

interface Hl7Separators {
  readonly field: string;
  readonly component: string;
  readonly repetition: string;
  readonly escape: string;
  readonly subcomponent: string;
  readonly encodingCharacters: string;
}

function parseHl7Separators(
  firstSegment: string,
  issues: TransformIssue[],
): Hl7Separators {
  if (!firstSegment.startsWith("MSH") || firstSegment.length < 8) {
    issues.push({
      ruleId: "hl7-msh",
      severity: "warning",
      message:
        "HL7 message does not start with a complete MSH segment; using default separators.",
    });

    return {
      field: "|",
      component: "^",
      repetition: "~",
      escape: "\\",
      subcomponent: "&",
      encodingCharacters: "^~\\&",
    };
  }

  const field = firstSegment.charAt(3);
  const encodingCharacters = firstSegment.slice(4, 8);
  const separators = [
    field,
    encodingCharacters.charAt(0),
    encodingCharacters.charAt(1),
    encodingCharacters.charAt(2),
    encodingCharacters.charAt(3),
  ];

  if (
    field.length === 0 ||
    new Set(separators.filter(Boolean)).size !== separators.filter(Boolean).length
  ) {
    issues.push({
      ruleId: "hl7-separators",
      severity: "warning",
      message:
        "HL7 MSH separators are incomplete or duplicated; missing separators use defaults.",
    });
  }

  return {
    field,
    component: encodingCharacters.charAt(0) || "^",
    repetition: encodingCharacters.charAt(1) || "~",
    escape: encodingCharacters.charAt(2) || "\\",
    subcomponent: encodingCharacters.charAt(3) || "&",
    encodingCharacters,
  };
}

function normalizeHl7Fields(
  segmentName: string,
  fields: readonly string[],
  separators: Hl7Separators,
): readonly string[] {
  if (segmentName !== "MSH") {
    return fields;
  }

  return [
    fields[0],
    separators.field,
    fields[1] ?? separators.encodingCharacters,
    ...fields.slice(2),
  ];
}

function splitHl7SegmentFields(
  line: string,
  separators: Hl7Separators,
): string[] {
  if (!line.startsWith("MSH")) {
    return splitHl7PreserveEmpty(line, separators.field, separators.escape);
  }

  const encodingCharacters = line.slice(4, 8);
  const rest = line.charAt(8) === separators.field ? line.slice(9) : "";

  return [
    "MSH",
    encodingCharacters || separators.encodingCharacters,
    ...splitHl7PreserveEmpty(rest, separators.field, separators.escape),
  ];
}

function parseHl7Field(
  segmentName: string,
  fieldNumber: number,
  field: string,
  separators: Hl7Separators,
): JsonValue {
  if (segmentName === "MSH" && (fieldNumber === 1 || fieldNumber === 2)) {
    return [[decodeHl7Escapes(field, separators)]];
  }

  return splitHl7PreserveEmpty(field, separators.repetition, separators.escape).map((repeat) =>
    splitHl7PreserveEmpty(repeat, separators.component, separators.escape).map((component) => {
      const subcomponents = splitHl7PreserveEmpty(
        component,
        separators.subcomponent,
        separators.escape,
      ).map(
        (subcomponent) => decodeHl7Escapes(subcomponent, separators),
      );

      return subcomponents.length === 1 ? subcomponents[0] : subcomponents;
    }),
  );
}

function decodeHl7Escapes(value: string, separators: Hl7Separators): string {
  const escape = escapeRegExp(separators.escape);
  const pattern = new RegExp(`${escape}(.+?)${escape}`, "g");

  return value.replace(pattern, (match, code: string) => {
    if (code === "F") {
      return separators.field;
    }

    if (code === "S") {
      return separators.component;
    }

    if (code === "T") {
      return separators.subcomponent;
    }

    if (code === "R") {
      return separators.repetition;
    }

    if (code === "E") {
      return separators.escape;
    }

    if (code === "H" || code === "N") {
      return "";
    }

    if (code.toLowerCase() === ".br") {
      return "\n";
    }

    if (code.startsWith("X") && /^[0-9A-Fa-f]+$/.test(code.slice(1))) {
      return decodeHl7HexEscape(code.slice(1));
    }

    return match;
  });
}

function decodeHl7HexEscape(hex: string): string {
  const bytes: number[] = [];

  for (let index = 0; index < hex.length; index += 2) {
    const byte = Number.parseInt(hex.slice(index, index + 2), 16);
    if (!Number.isNaN(byte)) {
      bytes.push(byte);
    }
  }

  if (typeof TextDecoder !== "undefined") {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
    } catch {
      return String.fromCharCode(...bytes);
    }
  }

  return String.fromCharCode(...bytes);
}

function createHl7Metadata(
  payload: JsonObject,
  separators: Hl7Separators,
  segmentOrder: JsonValue[],
  segmentCounts: JsonObject,
): JsonObject {
  const messageType = readPath(payload, "$.MSH[0][9][0][0]");
  const triggerEvent = readPath(payload, "$.MSH[0][9][0][1]");
  const messageStructure = readPath(payload, "$.MSH[0][9][0][2]");
  const version = readPath(payload, "$.MSH[0][12][0][0]");
  const variantCandidates = hl7VariantCandidates(
    messageType,
    triggerEvent,
    messageStructure,
  );

  return {
    separators: {
      field: separators.field,
      component: separators.component,
      repetition: separators.repetition,
      escape: separators.escape,
      subcomponent: separators.subcomponent,
      encodingCharacters: separators.encodingCharacters,
    },
    messageType: typeof messageType === "string" ? messageType : null,
    triggerEvent: typeof triggerEvent === "string" ? triggerEvent : null,
    messageStructure:
      typeof messageStructure === "string" ? messageStructure : null,
    variant: variantCandidates[0] ?? "UNKNOWN",
    variantCandidates,
    version: typeof version === "string" ? version : null,
    segmentOrder,
    segmentCounts,
  };
}

function hl7VariantCandidates(
  messageType: JsonValue | undefined,
  triggerEvent: JsonValue | undefined,
  messageStructure: JsonValue | undefined,
): JsonValue[] {
  const candidates: string[] = [];

  if (typeof messageStructure === "string" && messageStructure.length > 0) {
    candidates.push(messageStructure);
  }

  if (typeof messageType === "string" && messageType.length > 0) {
    if (typeof triggerEvent === "string" && triggerEvent.length > 0) {
      candidates.push(`${messageType}_${triggerEvent}`);
    }

    candidates.push(messageType);
  }

  return [...new Set(candidates)];
}

function splitHl7PreserveEmpty(
  value: string,
  separator: string,
  escapeCharacter: string,
): string[] {
  if (separator.length === 0) {
    return [value];
  }

  const parts: string[] = [];
  let current = "";
  let inEscape = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value.charAt(index);

    if (escapeCharacter.length > 0 && char === escapeCharacter) {
      inEscape = !inEscape;
      current += char;
      continue;
    }

    if (!inEscape && value.startsWith(separator, index)) {
      parts.push(current);
      current = "";
      index += separator.length - 1;
      continue;
    }

    current += char;
  }

  parts.push(current);
  return parts;
}

function readPath(payload: JsonObject, path: string): JsonValue | undefined {
  const tokens = parsePath(path);
  let current: JsonValue | undefined = payload;

  for (const token of tokens) {
    if (typeof token === "number") {
      if (!Array.isArray(current)) {
        return undefined;
      }

      current = current[token];
      continue;
    }

    if (!isJsonObject(current)) {
      return undefined;
    }

    current = current[token];
  }

  return current;
}

function parsePath(path: string): Array<string | number> {
  const normalized = path.startsWith("$.") ? path.slice(2) : path;
  const tokens: Array<string | number> = [];
  const matcher = /([^[.\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(normalized)) !== null) {
    if (match[1] !== undefined) {
      tokens.push(match[1]);
    }

    if (match[2] !== undefined) {
      tokens.push(Number(match[2]));
    }
  }

  return tokens;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
