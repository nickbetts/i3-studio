import Link from "next/link";
import { CURRENT_TERMS_VERSION } from "@/lib/onboarding-flow";

export const metadata = { title: "Privacy Policy · i3 Studio" };

// Placeholder policy content — needs legal review before this is relied on as a binding document.
export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Version {CURRENT_TERMS_VERSION} · Draft, pending legal review.</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">What we collect</h2>
        <p className="text-sm text-muted-foreground">
          Account details (name, email, role), onboarding information you submit about your business, and files, documents
          and messages you or your team upload or send through the client portal.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">How we use it</h2>
        <p className="text-sm text-muted-foreground">
          To deliver the services you have engaged us for: managing your projects, content, designs, documents, and support
          requests, and to communicate with you about your account.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Subprocessors</h2>
        <p className="text-sm text-muted-foreground">
          We use the following third parties to operate this platform: Vercel (hosting and file storage), Neon (database),
          and Mailgun (transactional email). Each processes data only as needed to provide their service to us.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Retention</h2>
        <p className="text-sm text-muted-foreground">
          We retain account and project data for as long as your account is active, plus a reasonable period afterward for
          legal, accounting, and audit purposes. Uploaded files are retained until you or we remove them or your account is
          closed.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Your rights</h2>
        <p className="text-sm text-muted-foreground">
          You can request a copy of the data we hold about your account, or ask us to delete it, by contacting your account
          manager or emailing us directly. We will respond within a reasonable timeframe.
        </p>
      </section>

      <p className="text-sm">
        <Link href="/terms" className="underline underline-offset-4">Terms of Use</Link>
      </p>
    </div>
  );
}
