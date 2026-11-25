import type { JsonObject, JsonValue } from "./types";

type PathToken = string | number;

export function readPath(
  payload: JsonObject,
  path: string,
): JsonValue | undefined {
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

export function writePath(
  target: JsonObject,
  path: string,
  value: JsonValue,
): void {
  const tokens = parsePath(path);
  let current: JsonObject | JsonValue[] = target;

  tokens.forEach((token, index) => {
    const isLast = index === tokens.length - 1;

    if (isLast) {
      if (typeof token === "number" && Array.isArray(current)) {
        current[token] = value;
        return;
      }

      if (typeof token === "string" && isJsonObject(current)) {
        current[token] = value;
      }

      return;
    }

    const nextToken = tokens[index + 1];
    const nextValue: JsonObject | JsonValue[] =
      typeof nextToken === "number" ? [] : {};

    if (typeof token === "number" && Array.isArray(current)) {
      if (current[token] === undefined) {
        current[token] = nextValue;
      }

      const child = current[token];
      if (isJsonObject(child) || Array.isArray(child)) {
        current = child;
      }

      return;
    }

    if (typeof token === "string" && isJsonObject(current)) {
      if (current[token] === undefined) {
        current[token] = nextValue;
      }

      const child = current[token];
      if (isJsonObject(child) || Array.isArray(child)) {
        current = child;
      }
    }
  });
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function cloneJsonObject(value: JsonObject): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function parsePath(path: string): PathToken[] {
  const normalized = path.startsWith("$.") ? path.slice(2) : path;
  const tokens: PathToken[] = [];
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
