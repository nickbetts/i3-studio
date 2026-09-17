import Link from "next/link";
import { CURRENT_TERMS_VERSION } from "@/lib/onboarding-flow";

export const metadata = { title: "Terms of Use · i3 Studio" };

export default function TermsOfUsePage() {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-6">
      <Link href="/" className="text-sm underline underline-offset-4">← Back to dashboard</Link>

      <div>
        <h1 className="text-2xl font-semibold">Terms of Use</h1>
        <p className="text-sm text-muted-foreground">Version {CURRENT_TERMS_VERSION} · Last updated 17 September 2026.</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">1. Acceptance of these terms</h2>
        <p className="text-sm text-muted-foreground">
          These Terms of Use (&ldquo;Terms&rdquo;) govern access to and use of the i3 Studio agency and client portal
          (the &ldquo;Platform&rdquo;), operated by i3MEDIA LTD, a company registered in England and Wales under company
          number 06864761, registered office Unit 2b First Floor, Flag Business Exchange, Vicarage Farm Road,
          Peterborough, England, PE1 5TX (&ldquo;i3 Studio&rdquo;, &ldquo;i3MEDIA&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
          By logging in to or using the Platform you agree to these Terms. If you do not agree, do not use the Platform.
        </p>
        <p className="text-sm text-muted-foreground">
          These Terms govern use of the Platform itself. They do not replace any separate signed service agreement,
          statement of work, or master services agreement between you and i3 Studio, which will take precedence over
          these Terms in the event of a conflict as it relates to the scope, fees, or delivery of services.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">2. Who can use the Platform</h2>
        <p className="text-sm text-muted-foreground">
          Access is by invitation only, limited to i3 Studio staff and individuals authorised by an active client
          account. You must be at least 18 years old and authorised to act on behalf of your organisation. You are
          responsible for keeping your login credentials confidential and for all activity carried out under your
          account. Notify us immediately at{" "}
          <a href="mailto:support@i3media.net" className="underline underline-offset-4">support@i3media.net</a> if you
          suspect unauthorised access to your account.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">3. Your content</h2>
        <p className="text-sm text-muted-foreground">
          Any files, documents, text, or other material you or your authorised users upload or submit through the
          Platform (&ldquo;Client Content&rdquo;) remains your property. You grant i3 Studio a limited licence to host,
          store, reproduce, and display Client Content solely for the purpose of providing the Platform and delivering
          the services you have engaged us for. You are responsible for ensuring you hold the necessary rights and
          consents for any Client Content you upload, and that it does not infringe the rights of, or contain personal
          data about, any third party without a lawful basis for sharing it with us.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">4. Acceptable use</h2>
        <p className="text-sm text-muted-foreground">You agree not to use the Platform to:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>upload or transmit unlawful, defamatory, infringing, or malicious content (including malware);</li>
          <li>attempt to access accounts, data, or areas of the Platform you are not authorised to access;</li>
          <li>probe, scan, or test the security of the Platform, or circumvent any access or rate limit controls, without our prior written consent;</li>
          <li>interfere with or disrupt the integrity or performance of the Platform or the accounts of other clients; or</li>
          <li>use the Platform in a way that breaches any applicable law or regulation.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">5. Approvals and records</h2>
        <p className="text-sm text-muted-foreground">
          Where the Platform records an approval, sign-off, or decision against your account (for example, approving
          content, designs, or documents), you agree that this record is treated as your organisation&apos;s authorised
          decision, made by the individual logged in to the account at the time.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">6. Availability and changes</h2>
        <p className="text-sm text-muted-foreground">
          We aim to keep the Platform available and secure but do not guarantee uninterrupted access. We may suspend
          access for maintenance, security, or non-payment, and may modify or discontinue features on reasonable notice
          where practicable. Except for our obligations under the Privacy Policy and applicable law, the Platform is
          provided &ldquo;as is&rdquo; without warranties of any kind, to the fullest extent permitted by law.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">7. Liability</h2>
        <p className="text-sm text-muted-foreground">
          Nothing in these Terms limits or excludes liability that cannot lawfully be limited or excluded (including
          liability for death, personal injury caused by negligence, or fraud). Subject to that, to the extent permitted
          by law, i3 Studio&apos;s liability arising from your use of the Platform is limited to direct losses and
          excludes indirect or consequential loss, and is capped in aggregate at the fees paid for the Platform (as
          distinct from separately contracted agency services) in the 12 months preceding the claim.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">8. Suspension and termination</h2>
        <p className="text-sm text-muted-foreground">
          We may suspend or disable your account if we reasonably believe these Terms have been breached, or if your
          organisation&apos;s engagement with i3 Studio ends. On termination, your right to access the Platform ends, but
          provisions of these Terms that by their nature should survive (including sections 3, 7, 9, and 10) will
          continue to apply.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">9. Data protection</h2>
        <p className="text-sm text-muted-foreground">
          Our collection and use of personal data through the Platform is described in our{" "}
          <Link href="/privacy" className="underline underline-offset-4">Privacy Policy</Link>. Where i3 Studio processes
          personal data on your organisation&apos;s behalf as part of the services provided, the terms of our data
          processing agreement (available on request) apply in addition to these Terms.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">10. Governing law</h2>
        <p className="text-sm text-muted-foreground">
          These Terms are governed by the laws of England and Wales, and any dispute arising from them is subject to the
          exclusive jurisdiction of the courts of England and Wales.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">11. Changes to these terms</h2>
        <p className="text-sm text-muted-foreground">
          We may update these Terms from time to time. Material changes will be reflected in a new version number shown
          above, and continued use of the Platform after a change takes effect constitutes acceptance of the updated
          Terms.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">12. Contact</h2>
        <p className="text-sm text-muted-foreground">
          Questions about these Terms can be sent to{" "}
          <a href="mailto:support@i3media.net" className="underline underline-offset-4">support@i3media.net</a>.
        </p>
      </section>

      <p className="text-sm">
        See also our <Link href="/privacy" className="underline underline-offset-4">Privacy Policy</Link> and{" "}
        <Link href="/security" className="underline underline-offset-4">Data Security</Link>.
      </p>
    </div>
  );
}

