import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { MED_NAME } from "@/lib/config";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token, process.env.SESSION_SECRET)) {
    redirect("/");
  }

  return (
    <main className="flex min-h-[70dvh] flex-col justify-center space-y-6">
      <header className="text-center">
        <h1 className="text-2xl font-semibold">{MED_NAME}</h1>
        <p className="mt-1 text-sm text-ink-2">
          Private tracker — enter your password to continue.
        </p>
      </header>
      <LoginForm />
    </main>
  );
}
