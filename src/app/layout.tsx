import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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

  if (!studioSession) {
    redirect(`${getInteropmedWebsiteUrl()}/studio`);
  }

  const websiteUrl = studioSession.websiteUrl ?? getInteropmedWebsiteUrl();

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <div className="border-b border-slate-200 bg-slate-950 text-slate-100">
          <div className="mx-auto flex max-w-[1760px] items-center justify-between gap-4 px-5 py-3 text-sm">
            <div className="flex items-center gap-3">
              <span className="font-semibold">Studio session active</span>
              <span className="text-slate-400">Managed by InteropMed account access</span>
            </div>
            <div className="flex items-center gap-4">
              <Link className="text-slate-300 hover:text-white" href={websiteUrl}>
                Website
              </Link>
              <Link className="text-slate-300 hover:text-white" href={`${websiteUrl}/account`}>
                Account
              </Link>
              <Link className="text-slate-300 hover:text-white" href="/auth/logout">
                Sign out
              </Link>
            </div>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
