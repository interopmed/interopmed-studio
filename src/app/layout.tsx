import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  getStudioSession,
  getInteropmedWebsiteUrl,
  STUDIO_SESSION_COOKIE,
} from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "InteropMed Studio",
  description: "Stateless visual mapping from legacy clinical payloads to FHIR.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const session = cookieStore.get(STUDIO_SESSION_COOKIE)?.value;
  const studioSession = getStudioSession(session);

  const websiteUrl = studioSession?.websiteUrl ?? getInteropmedWebsiteUrl();

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <div className="border-b border-slate-200 bg-slate-950 text-slate-100">
          <div className="mx-auto flex max-w-[1760px] items-center justify-between gap-4 px-5 py-3 text-sm">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-teal-400">InteropMed Studio</span>
              {studioSession ? (
                <>
                  <span className="text-slate-500">|</span>
                  <span className="text-xs text-slate-300">Session active</span>
                </>
              ) : (
                <>
                  <span className="text-slate-500">|</span>
                  <span className="rounded bg-teal-900/50 px-2 py-0.5 text-[11px] font-medium text-teal-300">
                    Open Access Workspace
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Link className="text-slate-300 hover:text-white" href={websiteUrl}>
                Website
              </Link>
              {studioSession ? (
                <>
                  <Link className="text-slate-300 hover:text-white" href={`${websiteUrl}/account`}>
                    Account
                  </Link>
                  <Link className="text-slate-300 hover:text-white" href="/auth/logout">
                    Sign out
                  </Link>
                </>
              ) : (
                <Link
                  className="rounded-lg bg-teal-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-teal-500"
                  href={`${websiteUrl}/account/login?next=/studio`}
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
