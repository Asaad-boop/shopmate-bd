import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NotePreset {
  id: string;
  label: string;
  icon: string;
  note_text: string;
  display_order: number;
  is_active: boolean;
}

export function useNotePresets() {
  return useQuery<NotePreset[]>({
    queryKey: ["note-presets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("note_presets")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as NotePreset[];
    },
  });
}

export function useAllNotePresets() {
  return useQuery<NotePreset[]>({
    queryKey: ["note-presets-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("note_presets")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as NotePreset[];
    },
  });
}

export function useUpsertPreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (preset: Partial<NotePreset> & { id?: string }) => {
      if (preset.id) {
        const { id, ...rest } = preset;
        const { error } = await supabase.from("note_presets").update(rest as any).eq("id", id);
        if (error) throw error;
      } else {
        const { id, ...rest } = preset;
        const { error } = await supabase.from("note_presets").insert(rest as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["note-presets"] });
      qc.invalidateQueries({ queryKey: ["note-presets-all"] });
    },
  });
}

export function useDeletePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("note_presets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["note-presets"] });
      qc.invalidateQueries({ queryKey: ["note-presets-all"] });
    },
  });
}
