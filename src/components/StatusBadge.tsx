import type { MemberStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: MemberStatus;
  className?: string;
}

const statusConfig: Record<MemberStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
  expiring_soon: { label: "Expiring Soon", className: "bg-amber-100 text-amber-700 border border-amber-200" },
  expired: { label: "Expired", className: "bg-red-100 text-red-700 border border-red-200" },
  has_debt: { label: "Has Debt", className: "bg-purple-100 text-purple-700 border border-purple-200" },
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", config.className, className)}
    >
      {config.label}
    </span>
  );
}
