import { redirect } from "next/navigation";

// Redirect /docs to Mintlify documentation
const DOCS_URL = "https://galaxyai-2e6d9fa2.mintlify.app";

export default function DocsRedirect() {
  redirect(DOCS_URL);
}
