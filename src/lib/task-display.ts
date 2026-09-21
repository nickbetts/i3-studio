export function taskDueLabel(dueDate: Date | null, status: string): "overdue" | "soon" | null {
  if (!dueDate || status === "done") return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 1) return "soon";
  return null;
}