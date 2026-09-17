import Link from "next/link";
import { CURRENT_TERMS_VERSION } from "@/lib/onboarding-flow";

export const metadata = { title: "Privacy Policy · i3 Studio" };

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Version {CURRENT_TERMS_VERSION} · Last updated 17 September 2026.</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">1. Who we are</h2>
        <p className="text-sm text-muted-foreground">
          This Privacy Policy is issued by i3MEDIA LTD, a company registered in England and Wales under company number
          06864761, with its registered office at Unit 2b First Floor, Flag Business Exchange, Vicarage Farm Road,
          Peterborough, England, PE1 5TX (&ldquo;i3 Studio&rdquo;, &ldquo;i3MEDIA&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
          We are the data controller for the personal data described in this policy. If you have any questions about
          this policy or how we handle your data, contact us at{" "}
          <a href="mailto:support@i3media.net" className="underline underline-offset-4">support@i3media.net</a>.
        </p>
        <p className="text-sm text-muted-foreground">
          This policy applies to the i3 Studio agency and client portal platform (the &ldquo;Platform&rdquo;) and to
          anyone with an account on it &mdash; agency staff and client users alike.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">2. What personal data we collect</h2>
        <p className="text-sm text-muted-foreground">We collect and process the following categories of personal data:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li><span className="text-foreground">Account data:</span> name, email address, role, and account status for anyone we create a login for.</li>
          <li><span className="text-foreground">Onboarding and business data:</span> the company, contact, brand, and project information a client submits through the onboarding wizard.</li>
          <li><span className="text-foreground">Content you upload or send:</span> documents, reference files, design assets, and messages exchanged through the portal, support tickets, or email.</li>
          <li><span className="text-foreground">Usage and technical data:</span> login timestamps, IP address (for security and rate-limiting), and audit trail entries recording actions taken on the Platform.</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          We do not use analytics, advertising, or tracking cookies. The Platform is not indexed by search engines and is
          not intended for anonymous public visitors.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">3. How we collect it</h2>
        <p className="text-sm text-muted-foreground">
          We collect personal data directly from you when you are given a login, complete onboarding, upload a file,
          raise a support request, or otherwise use the Platform. Support tickets can also be created from an inbound
          email you send us, which we process as you provide it.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">4. Why we process it and our legal basis</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li><span className="text-foreground">Performance of a contract</span> &mdash; to provide the agency services you have engaged us for: managing your projects, content, designs, documents, tasks, and support requests.</li>
          <li><span className="text-foreground">Legitimate interests</span> &mdash; to keep the Platform secure (e.g. rate-limiting, audit logging, fraud/abuse prevention), and to maintain an accurate record of approvals and account activity.</li>
          <li><span className="text-foreground">Legal obligation</span> &mdash; where we need to retain records for accounting, tax, or regulatory purposes, or respond to a lawful request from a regulator or court.</li>
          <li><span className="text-foreground">Consent</span> &mdash; only where we ask for it specifically (for example, optional preferences you choose to share); you may withdraw this at any time.</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Providing account and onboarding information is necessary for us to deliver the service; without it we cannot
          set up your account or begin work on your project.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">5. Who we share it with</h2>
        <p className="text-sm text-muted-foreground">
          We do not sell personal data. We share it only with the following processors, each acting under contract and
          only to the extent needed to provide their service to us:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li><span className="text-foreground">Vercel Inc.</span> &mdash; application hosting and file storage (Vercel Blob).</li>
          <li><span className="text-foreground">Neon Inc.</span> &mdash; managed Postgres database hosting.</li>
          <li><span className="text-foreground">Mailgun (Sinch)</span> &mdash; sending and receiving transactional and support email.</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Within your own organisation, your data is visible to i3 Studio staff who need it to deliver your services, and
          to your own authorised users. Where a subprocessor is located outside the UK/EEA, we rely on the UK
          International Data Transfer Addendum or EU Standard Contractual Clauses (as applicable) to protect your data.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">6. How long we keep it</h2>
        <p className="text-sm text-muted-foreground">
          We retain account, project, and communication data for as long as your account is active, and for up to 7
          years afterwards where needed for accounting, tax, or legal record-keeping. Uploaded files are retained until
          you, your account manager, or we remove them, or your account is closed and its retention period lapses.
          Password reset tokens and rate-limit records are short-lived and expire automatically within hours.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">7. How we protect it</h2>
        <p className="text-sm text-muted-foreground">
          Access to the Platform requires authentication, and access to client data is scoped by account and role.
          Passwords are hashed, uploaded documents are stored in access-controlled storage, and all administrative
          actions are recorded in an audit log. Data in transit is encrypted (HTTPS/TLS).
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">8. Your rights</h2>
        <p className="text-sm text-muted-foreground">Under UK GDPR / GDPR, you have the right to:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>request a copy of the personal data we hold about you (right of access);</li>
          <li>ask us to correct inaccurate or incomplete data (right to rectification);</li>
          <li>ask us to delete your data, subject to our legal and contractual obligations to retain certain records (right to erasure);</li>
          <li>ask us to restrict or object to processing in certain circumstances;</li>
          <li>ask us to provide your data in a portable format;</li>
          <li>withdraw consent at any time, where processing is based on consent; and</li>
          <li>lodge a complaint with a supervisory authority &mdash; in the UK, the Information Commissioner&apos;s Office (<a href="https://ico.org.uk" className="underline underline-offset-4" target="_blank" rel="noreferrer">ico.org.uk</a>).</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          To exercise any of these rights, contact your account manager or email{" "}
          <a href="mailto:support@i3media.net" className="underline underline-offset-4">support@i3media.net</a>. We will
          respond within one month, as required by law. We do not use automated decision-making or profiling that
          produces legal or similarly significant effects on you.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">9. Children</h2>
        <p className="text-sm text-muted-foreground">
          The Platform is a business tool intended for agency staff and client business contacts. It is not directed at,
          and we do not knowingly collect data from, children.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">10. Changes to this policy</h2>
        <p className="text-sm text-muted-foreground">
          We may update this policy from time to time. Material changes will be reflected in a new version number shown
          above, and where you have an active account we will let you know before the change takes effect.
        </p>
      </section>

      <p className="text-sm">
        <Link href="/terms" className="underline underline-offset-4">Terms of Use</Link>
      </p>
    </div>
  );
}

