import { CheckCircle2, Database, Github } from "lucide-react";

const statusItems = [
  {
    icon: Github,
    label: "GitHub access",
    value: "PAT configured by environment"
  },
  {
    icon: Database,
    label: "Database",
    value: "Postgres via Prisma"
  },
  {
    icon: CheckCircle2,
    label: "Workspace",
    value: "pnpm monorepo"
  }
];

export default function Home() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "GitHub Project Management";

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
        <header className="flex items-center justify-between border-b pb-5">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Project operations</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-foreground">
              {appName}
            </h1>
          </div>
          <div className="rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground">
            Scaffold
          </div>
        </header>

        <div className="grid flex-1 content-center gap-4 py-10 md:grid-cols-3">
          {statusItems.map((item) => {
            const Icon = item.icon;

            return (
              <article key={item.label} className="rounded-lg border bg-card p-5 shadow-sm">
                <Icon aria-hidden="true" className="h-5 w-5 text-primary" />
                <h2 className="mt-4 text-base font-semibold text-card-foreground">
                  {item.label}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.value}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
