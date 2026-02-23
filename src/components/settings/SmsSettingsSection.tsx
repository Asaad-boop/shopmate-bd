import { useState } from "react";
import { useTestSmsConnection, useSendSms } from "@/hooks/use-sms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, Send, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function SmsSettingsSection() {
  const [senderId, setSenderId] = useState("8809617618618");
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("This is a test SMS from your ERP system.");
  const testConnection = useTestSmsConnection();
  const sendSms = useSendSms();
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);

  const handleTest = async () => {
    try {
      await testConnection.mutateAsync();
      setConnectionOk(true);
      toast.success("✅ BulkSMSBD connected — API key is valid");
    } catch (e: any) {
      setConnectionOk(false);
      toast.error(`❌ Connection failed: ${e.message}`);
    }
  };

  const handleSendTest = async () => {
    if (!testPhone) { toast.error("Enter a phone number"); return; }
    sendSms.mutate({ to: testPhone, message: testMessage, sender_id: senderId });
  };

  return (
    <div className="space-y-5">
      {/* Sender ID */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sender ID</Label>
        <Input value={senderId} onChange={(e) => setSenderId(e.target.value)} placeholder="Your approved sender ID" className="h-11" />
        <p className="text-xs text-muted-foreground">
          Use the sender ID approved by BulkSMSBD. Default is the shared number.
        </p>
      </div>

      {/* API Key info */}
      <div className="p-3 bg-muted/50 rounded-lg border">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">API Key:</span>{" "}
          Stored securely as a Supabase secret. Update it from{" "}
          <a href="https://supabase.com/dashboard/project/ywutobfdoqktfkakbcch/settings/functions" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
            Supabase Secrets
          </a>
        </p>
      </div>

      <Separator />

      {/* Test Connection */}
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={handleTest} disabled={testConnection.isPending} className="h-10">
          {testConnection.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testing...</> : "Test Connection"}
        </Button>
        {connectionOk === true && <span className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="w-4 h-4" /> Connected</span>}
        {connectionOk === false && <span className="flex items-center gap-1 text-sm text-destructive"><XCircle className="w-4 h-4" /> Failed</span>}
      </div>

      <Separator />

      {/* Send Test SMS */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Send Test SMS</h3>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone Number</Label>
          <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="01XXXXXXXXX" className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Message</Label>
          <Textarea value={testMessage} onChange={(e) => setTestMessage(e.target.value)} rows={3} />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSendTest} disabled={sendSms.isPending} className="h-10">
            {sendSms.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</> : <><Send className="w-4 h-4 mr-1" /> Send Test</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
