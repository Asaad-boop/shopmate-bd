import { useState } from "react";
import { useAllNotePresets, useUpsertPreset, useDeletePreset, type NotePreset } from "@/hooks/use-note-presets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";

export default function NotePresetsSection() {
  const { data: presets, isLoading } = useAllNotePresets();
  const upsertMut = useUpsertPreset();
  const deleteMut = useDeletePreset();
  const [editModal, setEditModal] = useState<Partial<NotePreset> | null>(null);
  const [form, setForm] = useState({ label: "", icon: "📞", note_text: "", display_order: 0 });

  const openEdit = (p?: NotePreset) => {
    if (p) {
      setForm({ label: p.label, icon: p.icon || "📞", note_text: p.note_text, display_order: p.display_order });
      setEditModal(p);
    } else {
      setForm({ label: "", icon: "📞", note_text: "", display_order: (presets?.length || 0) + 1 });
      setEditModal({});
    }
  };

  const handleSave = () => {
    upsertMut.mutate(
      { ...form, id: editModal?.id },
      {
        onSuccess: () => { toast.success("Preset saved"); setEditModal(null); },
        onError: (err: any) => toast.error(err.message),
      }
    );
  };

  const toggleActive = (p: NotePreset) => {
    upsertMut.mutate({ id: p.id, is_active: !p.is_active }, { onSuccess: () => toast.success("Toggled") });
  };

  if (isLoading) return <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage quick note presets for call-center operators</p>
        <Button size="sm" onClick={() => openEdit()} className="gap-1.5 h-8 text-xs">
          <Plus className="w-3.5 h-3.5" /> Add Preset
        </Button>
      </div>

      <div className="space-y-2">
        {(presets || []).map(p => (
          <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
            <GripVertical className="w-4 h-4 text-muted-foreground/50 cursor-grab" />
            <span className="text-lg">{p.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.label}</p>
              <p className="text-[10px] text-muted-foreground truncate">{p.note_text}</p>
            </div>
            <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(p)}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => {
              deleteMut.mutate(p.id, { onSuccess: () => toast.success("Deleted") });
            }}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={!!editModal} onOpenChange={o => !o && setEditModal(null)}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle>{editModal?.id ? "Edit Preset" : "Add Preset"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Icon</Label>
                <Input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} className="h-10 text-center text-lg" />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Label</Label>
                <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} className="h-10" placeholder="e.g. Called — No Answer" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Note Text (saved to order)</Label>
              <Input value={form.note_text} onChange={e => setForm(f => ({ ...f, note_text: e.target.value }))} className="h-10" placeholder="e.g. Called customer — no answer" />
            </div>
            <div>
              <Label className="text-xs">Display Order</Label>
              <Input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} className="h-10 w-24" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={upsertMut.isPending || !form.label || !form.note_text}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
