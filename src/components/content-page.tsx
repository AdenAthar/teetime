export function ContentPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      {updated && <p className="mt-1 text-xs text-muted">Last updated {updated}</p>}
      <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-foreground/80 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_a]:text-crimson [&_a]:underline">
        {children}
      </div>
    </div>
  );
}
