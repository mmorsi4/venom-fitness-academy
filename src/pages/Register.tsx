import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Camera, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CameraCapture } from "@/components/CameraCapture";
import { useCreateMember, useClasses } from "@/hooks/use-data";
import { uploadMemberPhoto } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Gender } from "@/lib/types";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

export default function Register() {
  const [, params] = useRoute("/register/:id");
  const linkId = params?.id;
  const [_, navigate] = useLocation();

  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { data: classes = [] } = useClasses();
  const createMember = useCreateMember();

  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    parentPhone: "",
    birthDate: "",
    gender: "",
    classId: "",
  });

  useEffect(() => {
    if (!linkId) {
      setIsValid(false);
      setIsValidating(false);
      return;
    }
    
    // Check local storage to see if this link was already used on this device
    const used = localStorage.getItem(`used_link_${linkId}`);
    if (used) {
      setIsValid(false);
    } else {
      setIsValid(true);
    }
    setIsValidating(false);
  }, [linkId]);

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }));

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoBlob(file);
    setPhotoDataUrl(url);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }

    const phoneRegex = /^\d{11}$/;
    if (!phoneRegex.test(form.phone.trim())) {
      toast.error("Phone number must be exactly 11 digits");
      return;
    }

    if (form.parentPhone.trim() && !phoneRegex.test(form.parentPhone.trim())) {
      toast.error("Parent phone number must be exactly 11 digits");
      return;
    }

    createMember.mutate({
      name: form.name.trim(),
      phone: form.phone.trim(),
      parent_phone: form.parentPhone.trim() || null,
      birth_date: form.birthDate || null,
      gender: (form.gender as Gender) || null,
      class_id: form.classId === '__none__' ? null : (form.classId || null),
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
      id: 0, // Auto-generate ID
    }, {
      onSuccess: async (newMember) => {
        // Upload photo if available
        if (photoBlob && newMember) {
          try {
            const url = await uploadMemberPhoto(newMember.uuid, photoBlob);
            await supabase.from('members').update({ photo_url: url }).eq('uuid', newMember.uuid);
          } catch (err) {
            console.error("Failed to upload photo", err);
          }
        }
        
        // Mark link as used locally
        if (linkId) {
          localStorage.setItem(`used_link_${linkId}`, 'true');
        }

        setIsSubmitted(true);
      },
      onError: (err) => toast.error(`Error creating: ${err.message}`)
    });
  };

  if (isValidating) {
    return <div className="min-h-screen flex items-center justify-center bg-muted/30">Loading...</div>;
  }

  if (!isValid && !isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <h2 className="text-xl font-bold text-destructive mb-2">Invalid or Expired Link</h2>
            <p className="text-muted-foreground">This registration link is no longer valid or has already been used.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-50 p-4">
        <Card className="w-full max-w-md text-center border-emerald-200">
          <CardContent className="pt-6 space-y-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
            <h2 className="text-2xl font-bold text-emerald-800">Registration Complete!</h2>
            <p className="text-emerald-700">Your profile has been created successfully. Welcome to the academy!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 py-12">
      <Card className="w-full max-w-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Member Registration</CardTitle>
          <CardDescription>Fill out the details below to complete your registration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Photo */}
          <div className="flex flex-col items-center gap-4">
            {isCapturing ? (
              <div className="w-full max-w-sm rounded-lg overflow-hidden border shadow-sm relative">
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
                    <img src={photoDataUrl} alt="Preview" className="w-[150px] h-[150px] rounded-full object-cover border shadow-sm" />
                  ) : (
                    <div className="w-[150px] h-[150px] rounded-full bg-muted flex items-center justify-center border shadow-sm">
                      <Camera className="w-10 h-10 text-muted-foreground opacity-50" />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsCapturing(true)}>
                    <Camera className="w-4 h-4 mr-2" />
                    {photoDataUrl ? "Retake Photo" : "Take Photo"}
                  </Button>
                  <div className="relative">
                    <Input 
                      type="file" 
                      accept="image/*" 
                      onChange={handlePhotoUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full"
                    />
                    <Button type="button" variant="outline" size="sm" className="w-full pointer-events-none">
                      Upload Photo
                    </Button>
                  </div>
                  {photoDataUrl && (
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => {
                      setPhotoBlob(null);
                      setPhotoDataUrl(null);
                    }}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="m-name">Full Name *</Label>
            <Input
              id="m-name"
              placeholder="Full name"
              value={form.name}
              onChange={f('name')}
            />
          </div>

          {/* Phone + Parent Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="m-phone">Phone *</Label>
              <Input
                id="m-phone"
                placeholder="01XXXXXXXXX"
                value={form.phone}
                onChange={f('phone')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-parent-phone">Parent Phone</Label>
              <Input
                id="m-parent-phone"
                placeholder="01XXXXXXXXX"
                value={form.parentPhone}
                onChange={f('parentPhone')}
              />
            </div>
          </div>

          {/* Birth date + Gender */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="m-birth">Date of Birth</Label>
              <Input
                id="m-birth"
                type="date"
                value={form.birthDate}
                onChange={f('birthDate')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={v => setForm(p => ({ ...p, gender: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Class */}
          <div className="space-y-1.5">
            <Label htmlFor="m-class">Class</Label>
            <Select value={form.classId} onValueChange={v => setForm(p => ({ ...p, classId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {classes.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name ?? 'Class Name'} - {c.coach_name ?? 'Coach'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button 
            className="w-full mt-6" 
            size="lg" 
            onClick={handleSave}
            disabled={createMember.isPending}
          >
            {createMember.isPending ? "Submitting..." : "Complete Registration"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
