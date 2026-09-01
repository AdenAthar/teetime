import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth/session";
import { Logo } from "@/components/logo";
import { SignupForm } from "@/components/signup-form";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getUserId()) redirect("/searches");
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-4 flex items-center gap-2 text-sm text-foreground">
        <Link href="/login" aria-label="Back">
          ←
        </Link>
        <span className="text-base font-medium">Create New Account</span>
      </div>
      <Logo className="mx-auto" wordClassName="text-[1.6rem]" />
      <div className="mt-6">
        <SignupForm />
      </div>
    </div>
  );
}
