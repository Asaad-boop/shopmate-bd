import { useState, useEffect, useRef } from "react";
import { parseAddress, type ParseResult } from "@/lib/bangladesh-address";

export type AutoFillStatus = "idle" | "parsing" | "found" | "not_found";

interface UseAddressParserOptions {
  address: string;
  debounceMs?: number;
  onAutoFill?: (result: ParseResult) => void;
}

export function useAddressParser({ address, debounceMs = 500, onAutoFill }: UseAddressParserOptions) {
  const [status, setStatus] = useState<AutoFillStatus>("idle");
  const [result, setResult] = useState<ParseResult>({ district: null, thana: null });
  const prevAddress = useRef(address);
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

    const timer = setTimeout(() => {
      const parsed = parseAddress(address);
      setResult(parsed);

      if (parsed.district || parsed.thana) {
        setStatus("found");
        onAutoFillRef.current?.(parsed);
      } else {
        setStatus("not_found");
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [address, debounceMs]);

  const reset = () => {
    setStatus("idle");
    setResult({ district: null, thana: null });
  };

  return { status, result, reset };
}
