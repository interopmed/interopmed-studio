import { NextRequest, NextResponse } from "next/server";
import {
  createStudioSessionToken,
  getInteropmedWebsiteUrl,
  getSafeStudioReturnPath,
  readStudioToken,
  STUDIO_SESSION_COOKIE,
} from "@/lib/auth";

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
  const response = NextResponse.redirect(new URL(returnTo, request.nextUrl.origin));

  response.cookies.set(STUDIO_SESSION_COOKIE, createStudioSessionToken(returnTo), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
