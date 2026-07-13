import { useState, useRef } from "react";
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

export interface MemberForm {
  name: string;
  phone: string;
  parentPhone: string;
  birthDate: string;
  gender: string;
  id: number;
  customId: string;
  classId: string;
  isClinicVisitor: boolean;

  // Custom edit fields
  sessions_remaining: string;
  freeze_days_remaining: string;
  invitations_remaining: string;
  inbody_sessions_remaining: string;
  status: string;
  removePhoto?: boolean;
}



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

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }

    
    if (!validateEgyptPhone(form.phone)) {
      toast.error("Phone number must be exactly 11 digits");
      return;
    }

    if (form.parentPhone.trim() && !validateEgyptPhone(form.parentPhone)) {
      toast.error("Parent phone number must be exactly 11 digits");
      return;
    }

    if (editMember) {
      const updates: Partial<Member> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        parent_phone: form.parentPhone.trim() || null,
        birth_date: form.birthDate || null,
        gender: (form.gender as Gender) || null,
        class_id: form.isClinicVisitor || form.classId === '__none__' ? null : (form.classId || null),
        sessions_remaining: Number(form.sessions_remaining) || 0,
        freeze_days_remaining: Number(form.freeze_days_remaining) || 0,
        invitations_remaining: Number(form.invitations_remaining) || 0,
        inbody_sessions_remaining: Number(form.inbody_sessions_remaining) || 0,
        status: form.status as any,
      };

      if (!form.isClinicVisitor && editMember.id === -1) {
        updates.id = 0; // Signals queries.ts to auto-assign a new ID
      } else if (!form.isClinicVisitor && form.customId && editMember.id !== Number(form.customId)) {
        updates.id = Number(form.customId);
      }

      // Automatically update status based on sessions remaining
      if (updates.sessions_remaining !== undefined && editMember.sessions_remaining !== updates.sessions_remaining) {
        if (updates.sessions_remaining <= 0 && updates.sessions_remaining !== 999) {
          updates.status = 'expired';
        } else if (updates.sessions_remaining <= 2 && updates.sessions_remaining > 0 && updates.sessions_remaining !== 999) {
          updates.status = 'expiring_soon';
        } else if (updates.status === 'expired' && updates.sessions_remaining > 0) {
          updates.status = 'active';
        }
      }

      if (form.removePhoto) updates.photo_url = null;

      updateMember.mutate({ id: editMember.uuid, updates }, {
        onSuccess: async () => {
          if (photoBlob) {
            try {
              const url = await uploadMemberPhoto(editMember.uuid, photoBlob);
              await updateMember.mutateAsync({ id: editMember.uuid, updates: { photo_url: url } });
            } catch (err) { toast.error("Failed to upload photo"); }
          }
          // Sync with invoice if sessions changed
          if (updates.sessions_remaining !== undefined && editMember.sessions_remaining !== updates.sessions_remaining) {
            const latestInvoice = invoices.filter(i =>
              i.member_id === editMember.uuid &&
              (i.status === 'paid' || i.status === 'partial')
            ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            if (latestInvoice.length > 0) {
              updateInvoice.mutate({
                uuid: latestInvoice[0].uuid,
                updates: { sessions_remaining: updates.sessions_remaining }
              });
            }
          }

          toast.success(`${form.name} updated`);
          closeDialogs();
        },
        onError: (err) => toast.error(`Error updating: ${err.message}`)
      });
    } else {
      createMember.mutate({
        name: form.name.trim(),
        phone: form.phone.trim(),
        parent_phone: form.parentPhone.trim() || null,
        birth_date: form.birthDate || null,
        gender: (form.gender as Gender) || null,
        class_id: form.isClinicVisitor || form.classId === '__none__' ? null : (form.classId || null),
        status: 'new',
        sessions_remaining: 0,
        session_debt: 0,
        expires_at: null,
        member_since: new Date().toISOString(),
        package_id: null,
        package_name: 'None',
        freeze_days_remaining: 0,
        invitations_remaining: 0,
        inbody_sessions_remaining: 0,
        id: form.isClinicVisitor ? -1 : (form.customId ? Number(form.customId) : 0),
      }, {
        onSuccess: async (newMember) => {
          if (photoBlob && newMember) {
            try {
              const url = await uploadMemberPhoto(newMember.uuid, photoBlob);
              await updateMember.mutateAsync({ id: newMember.uuid, updates: { photo_url: url } });
            } catch (err) { toast.error("Failed to upload photo"); }
          }
          const params = new URLSearchParams(searchString);
          const createLeadId = params.get("createLeadId");
          if (createLeadId && newMember) {
            updateLead.mutate({
              id: createLeadId,
              updates: {
                status: 'Converted',
                converted_to_member_id: newMember.uuid,
                converted_by_user_id: currentUser?.id
              }
            });
            navigate("/members", { replace: true });
          }
          toast.success(`Member ${form.name} created`);
          closeDialogs();
        },
        onError: (err) => toast.error(`Error creating: ${err.message}`)
      });
    }
  };


  return (
    <>
      {/* Add / Edit Member Dialog */}
      <Dialog open={showAdd || !!editMember} onOpenChange={o => !o && closeDialogs()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editMember ? `Edit: ${editMember.name}` : "New Member"}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="details" className="w-full">
            {editMember && (
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
            )}
            <TabsContent value="details">
              <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
                {/* Photo Capture Section */}
                <div className="flex flex-col items-center gap-3 pb-4 border-b">
                  {isCapturing ? (
                    <div className="w-full">
                      <CameraCapture
                        onCapture={(blob, url) => {
                          setPhotoBlob(blob);
                          setPhotoDataUrl(url);
                          setIsCapturing(false);
                        }}
                        onCancel={() => setIsCapturing(false)}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-4 w-full">
                      <div className="relative">
                        {photoDataUrl ? (
                          <img src={photoDataUrl} alt="Preview" className="w-[200px] h-[200px] rounded-lg object-cover border shadow-sm" />
                        ) : (
                          <div className="w-[200px] h-[200px] rounded-lg bg-muted flex items-center justify-center border shadow-sm">
                            <Camera className="w-12 h-12 text-muted-foreground opacity-50" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setIsCapturing(true)}>
                          <Camera className="w-4 h-4 mr-2" />
                          {photoDataUrl ? "Retake" : "Take"} Photo
                        </Button>
                        <div className="relative">
                          <Input 
                            type="file" 
                            accept="image/*" 
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  const { blob, url } = await processImageFile(file);
                                  setPhotoBlob(blob);
                                  setPhotoDataUrl(url);
                                } catch (err) {
                                  toast.error("Failed to process image");
                                }
                              }
                              e.target.value = '';
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <Button type="button" variant="outline" size="sm" className="pointer-events-none">
                            Upload Photo
                          </Button>
                        </div>
                        {photoDataUrl && (
                          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => {
                            setPhotoBlob(null);
                            setPhotoDataUrl(null);
                            if (editMember && editMember.photo_url) {
                              setForm(f => ({ ...f, removePhoto: true } as any));
                            }
                          }}>
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Clinic Visitor Checkbox */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is-clinic-visitor"
                    checked={form.isClinicVisitor}
                    onCheckedChange={(c) => setForm(p => ({ ...p, isClinicVisitor: !!c }))}
                  />
                  <Label htmlFor="is-clinic-visitor" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    This is a Clinic Visitor
                  </Label>
                </div>

                {/* Custom ID (Optional) */}
                {!form.isClinicVisitor && (
                  <div className="space-y-1.5">
                    <Label htmlFor="m-custom-id">Member ID</Label>
                    <Input
                      id="m-custom-id"
                      placeholder="Leave empty for auto-generation"
                      type="number"
                      value={form.customId}
                      onChange={f('customId')}
                    />
                  </div>
                )}

                {/* Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="m-name">Full Name *</Label>
                  <Input
                    data-testid="input-new-member-name"
                    id="m-name"
                    placeholder="Full name"
                    value={form.name}
                    onChange={f('name')}
                  />
                </div>

                {/* Phone + Parent Phone */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="m-phone">Phone *</Label>
                    <Input
                      data-testid="input-new-member-phone"
                      id="m-phone"
                      placeholder="01XXXXXXXXX"
                      value={form.phone}
                      onChange={f('phone')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="m-parent-phone">Parent Phone</Label>
                    <Input
                      data-testid="input-new-member-parent-phone"
                      id="m-parent-phone"
                      placeholder="01XXXXXXXXX"
                      value={form.parentPhone}
                      onChange={f('parentPhone')}
                    />
                  </div>
                </div>

                {/* Birth date + Gender */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="m-birth">Date of Birth</Label>
                    <Input
                      data-testid="input-new-member-birthdate"
                      id="m-birth"
                      type="date"
                      value={form.birthDate}
                      onChange={f('birthDate')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Gender</Label>
                    <Select value={form.gender} onValueChange={v => setForm(p => ({ ...p, gender: v as Gender }))}>
                      <SelectTrigger data-testid="select-member-gender">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDERS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Class (Hidden for clinic visitors) */}
                {!form.isClinicVisitor && (
                  <div className="space-y-1.5">
                    <Label htmlFor="m-class">Class</Label>
                    <Select value={form.classId} onValueChange={v => setForm(p => ({ ...p, classId: v }))}>
                      <SelectTrigger data-testid="select-member-class">
                        <SelectValue placeholder="Select Class" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {classes.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name ?? 'Class Name'} - {c.coach_name ?? 'Coach'} ({c.schedules?.length || 0} slots)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Custom Session Edits */}
                {editMember && (
                  <div className="pt-4 mt-4 border-t space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Balances</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Sessions</Label>
                        <Input type="number" value={form.sessions_remaining} onChange={e => setForm(p => ({ ...p, sessions_remaining: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Freeze Days</Label>
                        <Input type="number" value={form.freeze_days_remaining} onChange={e => setForm(p => ({ ...p, freeze_days_remaining: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Invitations</Label>
                        <Input type="number" value={form.invitations_remaining} onChange={e => setForm(p => ({ ...p, invitations_remaining: e.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>InBody Sessions</Label>
                        <Input type="number" value={form.inbody_sessions_remaining} onChange={e => setForm(p => ({ ...p, inbody_sessions_remaining: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                )}

                {editMember && (
                  <div className="pt-4 mt-4 border-t space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Status</h4>
                    <div className="space-y-1.5">
                      <Select value={form.status} onValueChange={(val) => setForm({ ...form, status: val })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="frozen">Frozen</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}


                {/* Subscription Package — read-only display + change via invoice */}
                {editMember && (
                  <div className="space-y-1.5">
                    <Label>Subscription Package</Label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 rounded-md border bg-muted/50 text-sm text-foreground">
                        {editMember.package_name || "None"}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                          closeDialogs();
                          navigate(`/invoices?memberId=${editMember.uuid}`);
                        }}
                      >
                        Change Subscription
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      To change the subscription, create a new invoice with the desired package.
                    </p>
                  </div>
                )}

              </div>
              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={closeDialogs}>Cancel</Button>
                <Button
                  data-testid="btn-save-member"
                  onClick={handleSave}
                  disabled={createMember.isPending || updateMember.isPending}
                >
                  {createMember.isPending || updateMember.isPending ? "Saving..." : editMember ? "Save Changes" : "Create Member"}
                </Button>
              </DialogFooter>
            </TabsContent>

            {editMember && (
              <TabsContent value="history">
                <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
                  {(() => {
                    const history = auditLogs.filter(l =>
                      (l.action_type === 'checkin' || l.action_type === 'override_checkin') &&
                      l.details.includes(editMember.id.toString())
                    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                    if (history.length === 0) {
                      return <p className="text-sm text-muted-foreground text-center py-6">No check-in history found.</p>;
                    }

                    return (
                      <div className="space-y-3">
                        {history.map(log => (
                          <div key={log.id} className="p-3 rounded-lg border bg-muted/30 text-sm">
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{format(parseISO(log.timestamp), "MMM d, yyyy h:mm a")}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">{log.action_type === 'override_checkin' ? 'Override' : 'Check-in'}</span>
                            </div>
                            <div className="flex justify-between items-end mt-2">
                              <p className="text-muted-foreground text-xs leading-snug">{log.details}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

