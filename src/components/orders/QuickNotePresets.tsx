import { useNotePresets } from "@/hooks/use-note-presets";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  onPresetClick: (noteText: string) => void;
  disabled?: boolean;
}

export function QuickNotePresets({ onPresetClick, disabled }: Props) {
  const { data: presets, isLoading } = useNotePresets();

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-7 w-28 rounded-lg" />)}
      </div>
    );
  }

  if (!presets?.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {presets.map(p => (
        <Button
          key={p.id}
          variant="outline"
          size="sm"
          className="h-7 text-[10px] gap-1 px-2 hover:bg-primary/5 hover:border-primary/30 transition-colors"
          disabled={disabled}
          onClick={() => onPresetClick(p.note_text)}
        >
          <span>{p.icon}</span>
          <span>{p.label}</span>
        </Button>
      ))}
    </div>
  );
}
