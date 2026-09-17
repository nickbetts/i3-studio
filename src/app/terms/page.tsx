import Link from "next/link";
import { CURRENT_TERMS_VERSION } from "@/lib/onboarding-flow";

export const metadata = { title: "Terms of Use · i3 Studio" };

// Placeholder policy content — needs legal review before this is relied on as a binding document.
export default function TermsOfUsePage() {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Terms of Use</h1>
        <p className="text-sm text-muted-foreground">Version {CURRENT_TERMS_VERSION} · Draft, pending legal review.</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Using this platform</h2>
        <p className="text-sm text-muted-foreground">
          This portal is provided for your use as an active client of i3 Studio, to review and approve work, exchange files,
          and communicate with your account team. Access is limited to individuals you authorize on your account.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Your content</h2>
        <p className="text-sm text-muted-foreground">
          Files, documents, and information you upload remain yours. You are responsible for ensuring you have the rights to
          share anything you upload, and for the accuracy of information you provide during onboarding and elsewhere.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Acceptable use</h2>
        <p className="text-sm text-muted-foreground">
          Do not use the platform to upload unlawful content, attempt to access accounts or data that are not yours, or
          disrupt the service for other clients.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Changes</h2>
        <p className="text-sm text-muted-foreground">
          We may update these terms from time to time. Material changes will be reflected in a new version number, and
          continued use of the platform after a change constitutes acceptance of the updated terms.
        </p>
      </section>

      <p className="text-sm">
        <Link href="/privacy" className="underline underline-offset-4">Privacy Policy</Link>
      </p>
    </div>
  );
}
