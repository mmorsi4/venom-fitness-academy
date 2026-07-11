const fs = require('fs');

const membersPath = 'src/pages/Members.tsx';
let lines = fs.readFileSync(membersPath, 'utf8').split('\n');

// 1. Add import statement
const importStatement = `import { MemberFormDialog, memberToForm, emptyForm, type MemberForm } from "@/components/features/members/MemberFormDialog";`;
// find last import
let lastImportIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith('import ')) {
    lastImportIdx = i;
  }
}
lines.splice(lastImportIdx + 1, 0, importStatement);

// 2. Remove MemberForm interface, memberToForm, emptyForm
const startForm = lines.findIndex(l => l.includes('interface MemberForm {'));
const endForm = lines.findIndex(l => l.includes('const Members = () => {'));
if (startForm !== -1 && endForm !== -1) {
  // We leave an empty line or something, remove the block
  lines.splice(startForm, endForm - startForm);
}

// 3. Remove handleSave function
const startHandleSave = lines.findIndex(l => l.includes('const handleSave ='));
const endHandleSave = lines.findIndex(l => l.includes('const handleDelete ='));
if (startHandleSave !== -1 && endHandleSave !== -1) {
  lines.splice(startHandleSave, endHandleSave - startHandleSave);
}

// 4. Replace dialog with MemberFormDialog component
const startDialog = lines.findIndex(l => l.includes('{/* Add / Edit Member Dialog */}'));
const endDialog = lines.findIndex(l => l.includes('{/* Delete Member Confirmation */}'));
if (startDialog !== -1 && endDialog !== -1) {
  const componentStr = `      <MemberFormDialog
        showAdd={showAdd}
        editMember={editMember}
        form={form}
        setForm={setForm}
        closeDialogs={closeDialogs}
        invoices={invoices || []}
        classes={classes || []}
        currentUser={currentUser}
        searchString={searchString}
        auditLogs={auditLogs || []}
        isCapturing={isCapturing}
        setIsCapturing={setIsCapturing}
        photoBlob={photoBlob}
        setPhotoBlob={setPhotoBlob}
        photoDataUrl={photoDataUrl}
        setPhotoDataUrl={setPhotoDataUrl}
      />`;
  lines.splice(startDialog, endDialog - startDialog, componentStr);
}

// 5. Also need to ensure MemberForm type is imported if it was used? 
// MemberForm interface was removed, so we must export it from MemberFormDialog and import it
// Oh wait! `form` state in Members uses `MemberForm` interface. Let's make sure it's exported in MemberFormDialog.

fs.writeFileSync(membersPath, lines.join('\n'));
console.log('Members.tsx updated.');

