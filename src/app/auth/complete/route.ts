import { NextRequest, NextResponse } from "next/server";
import {
  createStudioSessionToken,
  getInteropmedWebsiteUrl,
  getSafeStudioReturnPath,
  readStudioToken,
  STUDIO_SESSION_COOKIE,
} from "@/lib/auth";

function getRequestOrigin(request: NextRequest): string {
  const host = request.headers.get("host") ?? request.nextUrl.host;
  return `${request.nextUrl.protocol}//${host}`;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const requestedReturnTo = getSafeStudioReturnPath(
    request.nextUrl.searchParams.get("returnTo"),
  );

  if (token === null) {
    return NextResponse.redirect(`${getInteropmedWebsiteUrl()}/studio`);
  }

  const payload = readStudioToken(token);

  if (payload === null) {
    return NextResponse.redirect(
      `${getInteropmedWebsiteUrl()}/account/login?next=${encodeURIComponent(
        `/studio?returnTo=${requestedReturnTo}`,
      )}`,
    );
  }

  const returnTo = getSafeStudioReturnPath(payload.returnTo, requestedReturnTo);
  const response = NextResponse.redirect(new URL(returnTo, getRequestOrigin(request)));

  response.cookies.set(STUDIO_SESSION_COOKIE, createStudioSessionToken(returnTo, payload.websiteUrl), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
