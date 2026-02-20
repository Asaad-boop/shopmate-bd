import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AutoFillStatus = "idle" | "parsing" | "found" | "not_found";

export interface ParseResult {
  district: string | null;
  thana: string | null;
}

interface UseAddressParserOptions {
  address: string;
  debounceMs?: number;
  onAutoFill?: (result: ParseResult) => void;
}

export function useAddressParser({ address, debounceMs = 800, onAutoFill }: UseAddressParserOptions) {
  const [status, setStatus] = useState<AutoFillStatus>("idle");
  const [result, setResult] = useState<ParseResult>({ district: null, thana: null });
  const prevAddress = useRef("");
  const onAutoFillRef = useRef(onAutoFill);
  onAutoFillRef.current = onAutoFill;

  useEffect(() => {
    if (address === prevAddress.current) return;
    prevAddress.current = address;

    if (!address || address.trim().length < 5) {
      setStatus("idle");
      return;
    }

    setStatus("parsing");

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("parse-address", {
          body: { address },
        });

        if (controller.signal.aborted) return;

        if (error) {
          console.error("AI address parse error:", error);
          setStatus("not_found");
          return;
        }

        const parsed: ParseResult = {
          district: data?.district || null,
          thana: data?.thana || null,
        };
        setResult(parsed);

        if (parsed.district || parsed.thana) {
          setStatus("found");
          onAutoFillRef.current?.(parsed);
        } else {
          setStatus("not_found");
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("AI address parse error:", err);
          setStatus("not_found");
        }
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [address, debounceMs]);

  const reset = () => {
    setStatus("idle");
    setResult({ district: null, thana: null });
  };

  return { status, result, reset };
}
