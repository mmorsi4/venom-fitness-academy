const fs = require('fs');
const lines = fs.readFileSync('src/pages/Members.tsx', 'utf8').split('\n');
const startFormIndex = lines.findIndex(l => l.includes('interface MemberForm'));
const endFormIndex = lines.findIndex(l => l.includes('function memberToForm'));
let formCode = lines.slice(startFormIndex, endFormIndex).join('\n');
formCode = formCode.replace(/const emptyForm.*?};\n\n/s, '');

const startHandleSave = lines.findIndex(l => l.includes('const handleSave ='));
const endHandleSave = lines.findIndex(l => l.includes('const handleDelete ='));
const handleSaveCode = lines.slice(startHandleSave, endHandleSave).join('\n');

const startDialog = lines.findIndex(l => l.includes('{/* Add / Edit Member Dialog */}'));
const endDialog = lines.findIndex(l => l.includes('{/* Delete Member Confirmation */}')) - 1;
const dialogCode = lines.slice(startDialog, endDialog).join('\n');

const result = `import { useState, useRef } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { validateEgyptPhone } from "@/lib/utils";
import { useCreateMember, useUpdateMember, useUpdateInvoice, useUpdateLead } from "@/hooks/use-data";
import { uploadMemberPhoto } from "@/lib/queries";
import { CameraCapture } from "@/components/CameraCapture";
import { processImageFile } from "@/lib/imageUtils";
import type { Member, Gender } from "@/lib/types";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { format, parseISO } from "date-fns";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

${formCode}

export const memberToForm = (m: Member): MemberForm => ({
  name: m.name, phone: m.phone, parentPhone: m.parent_phone || "",
  birthDate: m.birth_date || "", gender: m.gender || "male",
  classId: m.class_id || "__none__", id: m.id, customId: m.id === -1 || m.id === 0 ? "" : m.id.toString(),
  isClinicVisitor: m.id === -1,
  sessions_remaining: String(m.sessions_remaining ?? 0),
  freeze_days_remaining: String(m.freeze_days_remaining ?? 0),
  invitations_remaining: String(m.invitations_remaining ?? 0),
  inbody_sessions_remaining: String(m.inbody_sessions_remaining ?? 0),
  status: m.status
});

export const emptyForm: MemberForm = {
  name: "", phone: "", parentPhone: "", birthDate: "",
  gender: "", classId: "", id: 0, customId: "", isClinicVisitor: false,
  sessions_remaining: "0",
  freeze_days_remaining: "0",
  invitations_remaining: "0", inbody_sessions_remaining: "0",
  status: "active",
  removePhoto: false
};

interface Props {
  showAdd: boolean;
  editMember: Member | null;
  form: MemberForm;
  setForm: React.Dispatch<React.SetStateAction<MemberForm>>;
  closeDialogs: () => void;
  invoices: any[];
  classes: any[];
  currentUser: any;
  searchString: string;
  auditLogs: any[];
  isCapturing: boolean;
  setIsCapturing: (b: boolean) => void;
  photoBlob: Blob | null;
  setPhotoBlob: (b: Blob | null) => void;
  photoDataUrl: string | null;
  setPhotoDataUrl: (url: string | null) => void;
}

export function MemberFormDialog({ 
  showAdd, editMember, form, setForm, closeDialogs, invoices, classes, 
  currentUser, searchString, auditLogs, isCapturing, setIsCapturing, 
  photoBlob, setPhotoBlob, photoDataUrl, setPhotoDataUrl 
}: Props) {

  const createMember = useCreateMember();
  const updateMember = useUpdateMember();
  const updateInvoice = useUpdateInvoice();
  const updateLead = useUpdateLead();
  const [, setLocation] = useLocation();
  const navigate = (path: string, options?: any) => setLocation(path, options);

  const f = (key: keyof MemberForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }));

${handleSaveCode}

  return (
    <>
${dialogCode}
    </>
  );
}
`;

fs.writeFileSync('src/components/features/members/MemberFormDialog.tsx', result);
console.log('File created successfully.');

