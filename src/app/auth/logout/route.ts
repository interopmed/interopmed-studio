import { NextResponse } from "next/server";
import { getInteropmedWebsiteUrl, STUDIO_SESSION_COOKIE } from "@/lib/auth";

export async function GET() {
  const response = NextResponse.redirect(`${getInteropmedWebsiteUrl()}/account`);

  response.cookies.set(STUDIO_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
