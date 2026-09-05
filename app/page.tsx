import { redirect } from "next/navigation";

export default function HomePage() {
  // Middleware handles auth check and redirects to /workflows or /sign-in
  redirect("/workflows");
}
