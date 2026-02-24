import { useAllEvents } from "@/hooks/use-exceptions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const EVENT_COLORS: Record<string, string> = {
  created: "bg-blue-100 text-blue-800",
  resolved: "bg-emerald-100 text-emerald-800",
  ignored: "bg-gray-100 text-gray-800",
  assigned: "bg-indigo-100 text-indigo-800",
  status_changed: "bg-amber-100 text-amber-800",
  commented: "bg-purple-100 text-purple-800",
  reopened: "bg-red-100 text-red-800",
};

export function ResolutionLogTab() {
  const { data: events, isLoading } = useAllEvents();

  return (
    <div className="space-y-4 mt-4">
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Exception</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Actor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : !events?.length ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No events yet</TableCell></TableRow>
            ) : events.map((ev) => (
              <TableRow key={ev.id}>
                <TableCell className="text-xs whitespace-nowrap">{format(new Date(ev.created_at), "dd MMM yy HH:mm")}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${EVENT_COLORS[ev.event_type] || "bg-gray-100 text-gray-800"}`}>
                    {ev.event_type}
                  </span>
                </TableCell>
                <TableCell className="font-medium text-sm max-w-[200px] truncate">{ev.exceptions?.title || "—"}</TableCell>
                <TableCell><Badge variant="secondary" className="text-xs">{ev.exceptions?.source_module || "—"}</Badge></TableCell>
                <TableCell className="text-xs">{ev.exceptions?.severity || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">{ev.message || "—"}</TableCell>
                <TableCell className="text-xs">{ev.actor || "system"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
