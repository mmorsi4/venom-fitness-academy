import { useCreateAuditLog } from "./use-data";
import { useAuth } from "@/lib/auth";
import type { Database } from "@/lib/types";

type AuditLogCreate = Database['public']['Tables']['audit_logs']['Insert'];

export function useLogAction() {
  const { currentUser } = useAuth();
  const createAuditLog = useCreateAuditLog();

  return (params: Omit<AuditLogCreate, 'performed_by' | 'performer_name'>) => {
    createAuditLog.mutate({
      ...params,
      performed_by: currentUser?.id || null,
      performer_name: currentUser?.name || 'System',
    } as any);
  };
}
