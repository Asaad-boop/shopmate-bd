import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SendSmsParams {
  to: string;
  message: string;
  sender_id?: string;
}

export function useSendSms() {
  return useMutation({
    mutationFn: async ({ to, message, sender_id }: SendSmsParams) => {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: { to, message, sender_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => toast.success("SMS sent successfully"),
    onError: (e: any) => toast.error(`SMS failed: ${e.message}`),
  });
}

export function useTestSmsConnection() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: { action: "test" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
  });
}
