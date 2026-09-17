import Link from "next/link";

export const metadata = { title: "Data Security · i3 Studio" };

export default function DataSecurityPage() {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-6">
      <Link href="/" className="text-sm underline underline-offset-4">← Back to dashboard</Link>

      <div>
        <h1 className="text-2xl font-semibold">Data Security</h1>
        <p className="text-sm text-muted-foreground">How we keep your account, files, and data safe on this platform.</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Your login</h2>
        <p className="text-sm text-muted-foreground">
          Passwords are never stored in readable form &mdash; they&apos;re hashed with bcrypt, a one-way algorithm designed
          specifically to resist cracking, so even we can&apos;t see your actual password. Login attempts are rate-limited
          per account and per IP address, so automated bots can&apos;t simply guess passwords by brute force. If you change
          your password, every existing session is automatically signed out.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Who can see what</h2>
        <p className="text-sm text-muted-foreground">
          Every request is checked against your account, role, and organisation. A client user can only ever see their own
          organisation&apos;s projects, files, and conversations &mdash; there is no way to browse another client&apos;s
          data by guessing a link or changing an ID in the URL. Agency staff access is similarly scoped by role, and admin
          actions like impersonating a preview account are logged and restricted.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Your files and documents</h2>
        <p className="text-sm text-muted-foreground">
          Documents and reference files you upload are stored in a private storage bucket that isn&apos;t reachable
          directly from the internet. Every download is served through an authenticated link that checks you&apos;re
          allowed to see that specific file, and each download is recorded in an audit trail.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">In transit and at rest</h2>
        <p className="text-sm text-muted-foreground">
          All traffic to and from the platform is encrypted over HTTPS/TLS. Data is stored in a managed Postgres database
          with automatic backups and point-in-time recovery handled by our database provider, so data can be restored in
          the event of a failure.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Browser-level protections</h2>
        <p className="text-sm text-muted-foreground">
          We set standard security headers on every page &mdash; a Content Security Policy, clickjacking protection
          (X-Frame-Options), MIME-sniffing protection, and strict transport security (HSTS) &mdash; to reduce the risk of
          malicious scripts, embedded frames, or downgraded connections.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Keeping a record</h2>
        <p className="text-sm text-muted-foreground">
          Actions that matter &mdash; approvals, file uploads and downloads, account changes, sign-ins &mdash; are written
          to an audit log we can review if something looks wrong. Suspicious activity (like repeated failed logins or
          unusual download volumes) is throttled automatically.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Keeping the platform itself healthy</h2>
        <p className="text-sm text-muted-foreground">
          We keep our software dependencies patched and monitor for known vulnerabilities in the libraries the platform
          is built on. Server-side errors are logged so problems can be caught and fixed quickly.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Found a problem?</h2>
        <p className="text-sm text-muted-foreground">
          If you believe you&apos;ve found a security issue with the platform, please tell us before telling anyone else,
          at{" "}
          <a href="mailto:support@i3media.net" className="underline underline-offset-4">support@i3media.net</a>. We take
          reports seriously and will respond promptly.
        </p>
      </section>

      <p className="text-sm">
        See also our <Link href="/privacy" className="underline underline-offset-4">Privacy Policy</Link> and{" "}
        <Link href="/terms" className="underline underline-offset-4">Terms of Use</Link>.
      </p>
    </div>
  );
}
