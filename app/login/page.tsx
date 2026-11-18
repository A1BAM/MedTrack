import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";

// Anyone on the internet can load this page, so it says nothing about what
// is being tracked: no medication name, here or in the tab title.
export const metadata = { title: "MedTrack" };

export default async function LoginPage() {
  const cookieStore = await cookies();
  if (await isValidSession(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect("/");
  }

  return (
    <main className="flex min-h-[70dvh] flex-col justify-center space-y-6">
      <header className="text-center">
        <h1 className="screen-title">MedTrack</h1>
        <p className="mt-2 text-[13.5px] text-ink-2">
          Private tracker — enter your password to continue.
        </p>
      </header>
      <LoginForm />
    </main>
  );
}
