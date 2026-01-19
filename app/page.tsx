import { redirect } from "next/navigation";

export default function HomePage() {
  // Middleware handles auth check and redirects to /dashboard or /sign-in
  redirect("/dashboard");
}
