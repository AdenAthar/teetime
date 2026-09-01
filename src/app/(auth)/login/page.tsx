import Link from "next/link";
import { getUserId } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { LoginFlow } from "@/components/login-flow";
import { enterDemo } from "@/lib/auth/actions";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getUserId()) redirect("/searches");
  return (
    <div className="mx-auto w-full max-w-sm text-center">
      <Logo className="mx-auto" wordClassName="text-[1.6rem]" />
      <h1 className="mt-8 text-xl text-foreground/90">Log in to continue</h1>
      <div className="mt-8">
        <LoginFlow />
      </div>
      <p className="mt-8 text-xs text-blue">Don&apos;t have a teetime account?</p>
      <Link
        href="/signup"
        className="mt-2 block rounded-md border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-background"
      >
        Create a New Account
      </Link>

      <form action={enterDemo} className="mt-6 border-t border-border pt-6">
        <button className="w-full rounded-md bg-foreground/90 px-4 py-2.5 text-sm font-semibold text-white hover:bg-foreground">
          Explore the demo — no signup
        </button>
        <p className="mt-2 text-[11px] text-muted">
          Signs you into a shared demo account so you can try creating a search.
        </p>
      </form>
    </div>
  );
}
