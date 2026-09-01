import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth/session";
import { Logo } from "@/components/logo";
import { VerifyForm } from "@/components/verify-form";

export const dynamic = "force-dynamic";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string; channel?: string; dev?: string }>;
}) {
  if (await getUserId()) redirect("/searches");
  const sp = await searchParams;
  if (!sp.to) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-sm">
      <Logo className="mx-auto" wordClassName="text-[1.6rem]" />
      <div className="mt-8">
        <VerifyForm identifier={sp.to} channel={sp.channel ?? "EMAIL"} devCode={sp.dev} />
      </div>
    </div>
  );
}
