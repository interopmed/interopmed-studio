# InteropMed Studio — Healthcare Data Mapping & Integration Package Workbench

[![Subdomain](https://img.shields.io/badge/Subdomain-studio.interopmed.com-0d9488?style=for-the-badge&logo=google-chrome&logoColor=white)](https://studio.interopmed.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Standards](https://img.shields.io/badge/Standards-FHIR%20R4%20%7C%20HL7%20v2-0284c7?style=for-the-badge)](https://hl7.org/fhir/)

**InteropMed Studio** is a browser-based visual mapping and code-generation workbench hosted at **[studio.interopmed.com](https://studio.interopmed.com)**.

It allows health informaticians, digital health engineers, and integration specialists to visually map legacy healthcare messages (raw HL7 v2 and JSON) into standard **FHIR R4 resources**, test pipeline transformations in real time, and export production-ready integration packages (TypeScript, Python, and Node.js).

---

## Key Features

* **Visual Field-to-Field Mapper:** Map legacy HL7 fields (e.g. `PID-3`, `PV1-19`, `OBX-5`) directly to target FHIR resource attributes (`Patient.identifier`, `Observation.valueQuantity`, etc.).
* **Built-in Healthcare Normalization Transforms:**
  * `compactDateToIso`: Converts HL7 timestamp strings (`202605270900`) to standard ISO-8601 datetimes.
  * `fhirAdministrativeGender`: Maps legacy gender flags to FHIR codes (`M` $\rightarrow$ `male`, `F` $\rightarrow$ `female`).
  * `fhirIdentifierSystem`: Normalizes identifier namespaces into standard URI formats.
* **Workflow Templates:**
  * **ADT Admission:** `Patient`, `Encounter`, `Condition`, `Procedure`
  * **Lab Result:** `Patient`, `Encounter`, `Observation`, `DiagnosticReport`, `Specimen`
  * **Medication Order:** `Patient`, `Encounter`, `Medication`, `MedicationRequest`, `MedicationStatement`
  * **Clinical Referral:** `Patient`, `Practitioner`, `Organization`, `ServiceRequest`, `DocumentReference`
* **Multi-Target Code Generation:** Generates ready-to-deploy ETL pipeline code in **TypeScript**, **Python**, or **Node.js**.
* **Stateless & Zero PHI:** Handled entirely in memory; no patient data is logged or stored at rest.

---

## Subdomain & SSO Authentication Architecture

Studio is hosted on the **`studio.interopmed.com`** subdomain and uses HMAC-SHA256 token verification for single sign-on from the main website ([interopmed.com](https://www.interopmed.com)):

```text
[User on www.interopmed.com] 
       │
       ▼ (Clicks "Studio" in Navbar or goes to /studio)
[Website Authenticates User Session]
       │
       ▼ (Mints signed HMAC-SHA256 Launch Token)
[Redirects to studio.interopmed.com/auth/complete?token=...&returnTo=/]
       │
       ▼ (Studio validates signature with INTEROPMED_STUDIO_SHARED_SECRET)
[Sets HttpOnly Session Cookie "interopmed_studio_session"]
       │
       ▼
[User lands directly on studio.interopmed.com workspace]
```

---

## Configuration & Environment Variables

| Variable | Description | Example (Production) | Example (Local Dev) |
|---|---|---|---|
| `INTEROPMED_WEBSITE_URL` | Main website origin for login and redirects | `https://www.interopmed.com` | `http://127.0.0.1:3000` |
| `INTEROPMED_STUDIO_SHARED_SECRET` | HMAC signature secret shared with website | `secure_secret_key` | `interopmed-studio-dev-secret` |
| `PORT` | Local server port | `3100` | `3100` |

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start development server on port 3100
npm run dev

# 3. Open Studio in browser
# http://localhost:3100
```

---

## Deploying to Subdomain (`studio.interopmed.com`)

### Step 1: Deploy on Vercel
1. In the Vercel dashboard, click **Add New Project** $\rightarrow$ select the `interopmed-studio` repository.
2. Set Framework Preset to **Next.js**.
3. Under **Environment Variables**, add:
   * `INTEROPMED_WEBSITE_URL` = `https://www.interopmed.com`
   * `INTEROPMED_STUDIO_SHARED_SECRET` = `(same secret configured on interopmed-website)`
4. Click **Deploy**.

### Step 2: Configure Subdomain DNS
1. In Vercel Project Settings $\rightarrow$ **Domains**, add:
   ```text
   studio.interopmed.com
   ```
2. In your DNS provider (Cloudflare, Namecheap, GoDaddy, etc.) for `interopmed.com`:
   * **Type:** `CNAME`
   * **Name:** `studio`
   * **Target:** `cname.vercel-dns.com`
   * **Proxy Status:** DNS Only (or Proxied if using Cloudflare with SSL Full/Strict)

Once DNS propagates (usually 1–5 minutes), `https://studio.interopmed.com` is live with automated SSL certificates!

---

## License

This project is licensed under the **MIT License**.
