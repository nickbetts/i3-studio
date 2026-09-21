import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/sidebar-nav";
import { db } from "@/db";
import { activeTimers, contentItems, designAssets, documents, taskAssignments, tasks, tickets, users } from "@/db/schema";
import { requireAgencyUser } from "@/lib/auth-helpers";
import { isPreviewing } from "@/lib/auth-helpers";
import { and, count, eq, inArray } from "drizzle-orm";
import { TimeTracker, type ActiveTimer } from "./time/time-tracker";

export default async function AgencyLayout({ children }: { children: ReactNode }) {
  const user = await requireAgencyUser();
  const previewing = await isPreviewing();
  const record = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  const permissions = record?.permissions as { tabs?: unknown } | null;
  const allowedTabs = user.role === "admin" || !Array.isArray(permissions?.tabs) ? null : permissions.tabs;
  const previewUsers = user.role === "admin" && !previewing ? await db.query.users.findMany({ where: (row, { inArray }) => inArray(row.role, ["admin", "account_manager", "content_writer", "client"]) }) : [];
  const previewTargets = previewUsers.map((target) => ({ id: target.id, label: `${target.name || target.email} (${target.role})`, destination: target.role === "client" ? "/portal" : "/agency" }));

  const [[pendingFiles], [pendingDesigns], [openTickets], [pendingContent], [myOpenTasks], timerClients, timerProjects, timerTasks, activeTimer] = await Promise.all([
    db.select({ value: count() }).from(documents).where(eq(documents.status, "pending")),
    db.select({ value: count() }).from(designAssets).where(eq(designAssets.status, "pending")),
    db.select({ value: count() }).from(tickets).where(inArray(tickets.status, ["open", "pending"])),
    user.role === "content_writer"
      ? db.select({ value: count() }).from(contentItems).where(and(eq(contentItems.assignedToUserId, user.id), inArray(contentItems.status, ["am_changes", "client_changes"])))
      : db.select({ value: count() }).from(contentItems).where(eq(contentItems.status, "pending_am")),
    db.select({ value: count() }).from(taskAssignments).innerJoin(tasks, eq(taskAssignments.taskId, tasks.id)).where(and(eq(taskAssignments.userId, user.id), inArray(tasks.status, ["open", "in_progress", "blocked"]))),
    db.query.clientAccounts.findMany({ columns: { id: true, name: true }, orderBy: (client, { asc }) => [asc(client.name)] }),
    db.query.projects.findMany({ columns: { id: true, clientAccountId: true, name: true }, orderBy: (project, { asc }) => [asc(project.name)] }),
    db.query.tasks.findMany({ columns: { id: true, clientAccountId: true, projectId: true, title: true }, orderBy: (task, { asc }) => [asc(task.title)] }),
    db.query.activeTimers.findFirst({ where: eq(activeTimers.userId, user.id) }),
  ]);

  const activeTimerView: ActiveTimer | null = activeTimer ? {
    startedAt: activeTimer.startedAt.toISOString(),
    clientName: timerClients.find((client) => client.id === activeTimer.clientAccountId)?.name ?? "Client work",
    projectName: activeTimer.projectId ? timerProjects.find((project) => project.id === activeTimer.projectId)?.name ?? null : null,
    taskTitle: activeTimer.taskId ? timerTasks.find((task) => task.id === activeTimer.taskId)?.title ?? null : null,
  } : null;

  const navItems: NavItem[] = [
    { href: "/agency", label: "Dashboard", icon: "dashboard" },
    { href: "/agency/clients", label: "Clients", icon: "clients" },
    { href: "/agency/projects", label: "Projects", icon: "projects" },
    { href: "/agency/tasks", label: "Tasks", icon: "tasks", count: myOpenTasks?.value ?? 0 },
    { href: "/agency/time", label: "Time", icon: "time" },
    { href: "/agency/content", label: "Content", icon: "content", count: pendingContent?.value ?? 0 },
    { href: "/agency/files", label: "Files", icon: "files", count: pendingFiles?.value ?? 0 },
    { href: "/agency/designs", label: "Designs", icon: "designs", count: pendingDesigns?.value ?? 0 },
    { href: "/agency/support", label: "Support", icon: "support", count: openTickets?.value ?? 0 },
    { href: "/agency/reports", label: "Reports", icon: "reports" },
    { href: "/agency/settings", label: "Settings", icon: "settings" },
  ];
  const visibleItems = allowedTabs ? navItems.filter((item) => allowedTabs.includes(item.icon)) : navItems;
  visibleItems.push({ href: "/agency/calendar", label: "Calendar", icon: "calendar" });

  return (
    <AppShell
      brand="i3 Studio"
      roleLabel={user.role === "admin" ? "Admin" : user.role === "content_writer" ? "Content Writer" : "Account Manager"}
      navItems={visibleItems}
      preview={user.role === "admin"}
      previewTargets={previewTargets}
      previewing={previewing}
      user={{ name: user.name, email: user.email }}
    >
      {children}
      <TimeTracker clients={timerClients} projects={timerProjects} tasks={timerTasks} initialActive={activeTimerView} />
    </AppShell>
  );
}
