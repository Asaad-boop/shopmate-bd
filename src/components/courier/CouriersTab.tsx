import { useState } from "react";
import { useCouriers, useAddCourier, useToggleCourier } from "@/hooks/use-courier";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Truck } from "lucide-react";
import { formatDateTime } from "@/lib/format";

export function CouriersTab() {
  const { data: couriers, isLoading } = useCouriers();
  const addCourier = useAddCourier();
  const toggleCourier = useToggleCourier();
  const [newName, setNewName] = useState("");

  const handleAdd = () => {
    if (!newName.trim()) return;
    addCourier.mutate(newName.trim());
    setNewName("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Truck className="w-4 h-4" /> Courier Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Courier name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="max-w-xs"
          />
          <Button size="sm" onClick={handleAdd} disabled={addCourier.isPending}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-20">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(couriers || []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? "default" : "secondary"}>
                      {c.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={c.is_active}
                      onCheckedChange={(checked) => toggleCourier.mutate({ id: c.id, is_active: checked })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
