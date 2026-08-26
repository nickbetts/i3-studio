import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { accountManagerAssignments, clientAccounts, organizations, users } from "./schema";

config({ path: ".env.local" });

async function upsertUser(input: {
  email: string;
  name: string;
  password: string;
  role: "admin" | "account_manager" | "client";
  clientAccountId?: string | null;
  title?: string;
}) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  if (existing) {
    await db
      .update(users)
      .set({
        name: input.name,
        passwordHash,
        role: input.role,
        status: "active",
        clientAccountId: input.clientAccountId ?? null,
        title: input.title,
      })
      .where(eq(users.id, existing.id));
    return existing.id;
  }
  const [row] = await db
    .insert(users)
    .values({
      email: input.email,
      name: input.name,
      passwordHash,
      role: input.role,
      status: "active",
      clientAccountId: input.clientAccountId ?? null,
      title: input.title,
    })
    .returning({ id: users.id });
  return row.id;
}

async function main() {
  const [org] = await db
    .insert(organizations)
    .values({ name: "i3 Studio", slug: "i3-studio" })
    .onConflictDoNothing({ target: organizations.slug })
    .returning({ id: organizations.id });

  const orgId =
    org?.id ?? (await db.query.organizations.findFirst({ where: eq(organizations.slug, "i3-studio") }))!.id;

  const adminId = await upsertUser({
    email: "admin@i3studio.com",
    name: "i3 Admin",
    password: "password123",
    role: "admin",
    title: "Studio Director",
  });

  await upsertUser({
    email: "admin@i3media.net",
    name: "i3 Media Admin",
    password: "i3gangang",
    role: "admin",
    title: "Studio Administrator",
  });

  const managerId = await upsertUser({
    email: "manager@i3studio.com",
    name: "Alex Manager",
    password: "password123",
    role: "account_manager",
    title: "Account Manager",
  });

  // Demo client account (fresh — starts in onboarding).
  const existingClient = await db.query.clientAccounts.findFirst({
    where: eq(clientAccounts.slug, "acme"),
  });
  const clientAccountId =
    existingClient?.id ??
    (
      await db
        .insert(clientAccounts)
        .values({ organizationId: orgId, name: "Acme Co", slug: "acme", status: "onboarding" })
        .returning({ id: clientAccounts.id })
    )[0].id;

  await upsertUser({
    email: "client@acme.com",
    name: "Casey Client",
    password: "password123",
    role: "client",
    clientAccountId,
    title: "Marketing Lead",
  });

  await db
    .insert(accountManagerAssignments)
    .values({ clientAccountId, userId: managerId })
    .onConflictDoNothing();
  await db
    .insert(accountManagerAssignments)
    .values({ clientAccountId, userId: adminId })
    .onConflictDoNothing();

  console.log("Seed complete. Logins (password: password123):");
  console.log("  admin@i3studio.com    (admin)");
  console.log("  manager@i3studio.com  (account manager)");
  console.log("  client@acme.com       (client — will see onboarding)");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
