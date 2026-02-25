import { ClipboardList } from "lucide-react";

export default function PostingQueue() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <ClipboardList className="w-6 h-6" /> Posting Queue
      </h1>
      <p className="text-muted-foreground">Review and approve pending journal entries before posting to the ledger.</p>
      <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground">
        No pending postings in queue.
      </div>
    </div>
  );
}
