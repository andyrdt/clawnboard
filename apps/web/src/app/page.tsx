import { redirect } from "next/navigation";

// No landing page needed for local single-user dashboard
// Go straight to the moltbot management interface
export default function HomePage() {
  redirect("/dashboard");
}
