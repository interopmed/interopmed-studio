import { createHmac, timingSafeEqual } from "node:crypto";

export const STUDIO_SESSION_COOKIE = "interopmed_studio_session";

const DEFAULT_WEBSITE_URL = "http://127.0.0.1:3000";
const DEFAULT_SHARED_SECRET = "interopmed-studio-dev-secret";

type StudioLaunchPayload = {
  exp: number;
  returnTo: string;
  websiteUrl?: string;
};

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function createSignature(payload: string): string {
  return createHmac("sha256", getStudioSharedSecret())
    .update(payload)
    .digest("base64url");
}

export function getStudioSharedSecret(): string {
  return process.env.INTEROPMED_STUDIO_SHARED_SECRET ?? DEFAULT_SHARED_SECRET;
}

export function getInteropmedWebsiteUrl(): string {
  const value = process.env.INTEROPMED_WEBSITE_URL?.trim() || DEFAULT_WEBSITE_URL;

  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_WEBSITE_URL;
  }
}

export function getSafeStudioReturnPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (typeof value !== "string") {
    return fallback;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

export function getSafeWebsiteUrl(value: string | undefined): string {
  if (typeof value !== "string") {
    return getInteropmedWebsiteUrl();
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return getInteropmedWebsiteUrl();
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    return getInteropmedWebsiteUrl();
  }
}

export function createStudioSessionToken(
  returnTo: string,
  websiteUrl?: string,
  maxAgeSeconds = 60 * 60 * 8,
): string {
  const payload: StudioLaunchPayload = {
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
    returnTo,
    websiteUrl: getSafeWebsiteUrl(websiteUrl),
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = createSignature(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function readStudioToken(
  token: string,
): StudioLaunchPayload | null {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = createSignature(encodedPayload);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as StudioLaunchPayload;

    if (typeof payload.exp !== "number" || typeof payload.returnTo !== "string") {
      return null;
    }

    if (payload.websiteUrl !== undefined) {
      payload.websiteUrl = getSafeWebsiteUrl(payload.websiteUrl);
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function isValidStudioSession(value: string | undefined): boolean {
  return readStudioToken(value ?? "") !== null;
}

export function getStudioSession(value: string | undefined): StudioLaunchPayload | null {
  return readStudioToken(value ?? "");
}
