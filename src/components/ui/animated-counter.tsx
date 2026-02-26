import { useEffect, useRef, useState, memo } from "react";

/** Parse a formatted string like "৳1,234" into a raw number */
function parseDisplayValue(str: string): number {
  const cleaned = str.replace(/[^\d.\-]/g, "");
  return parseFloat(cleaned) || 0;
}

/** Easing: cubic ease-out */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

interface AnimatedCounterProps {
  value: string;
  duration?: number;
  className?: string;
}

/** Animates between formatted currency/number strings. Preserves prefix/suffix formatting. */
export const AnimatedCounter = memo(function AnimatedCounter({
  value,
  duration = 800,
  className = "",
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(value);
  const prevNumRef = useRef(parseDisplayValue(value));
  const rafRef = useRef<number>(0);

  // Extract prefix (e.g. "৳") and suffix
  const prefix = value.match(/^[^\d\-]*/)?.[0] || "";
  const suffix = value.match(/[^\d]*$/)?.[0] || "";

  useEffect(() => {
    const targetNum = parseDisplayValue(value);
    const startNum = prevNumRef.current;
    const diff = targetNum - startNum;

    if (Math.abs(diff) < 0.5) {
      setDisplay(value);
      prevNumRef.current = targetNum;
      return;
    }

    const startTime = performance.now();
    cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOut(progress);
      const current = startNum + diff * eased;

      // Format with commas
      const formatted = current < 0
        ? `-${prefix}${Math.abs(Math.round(current)).toLocaleString("en-IN")}${suffix}`
        : `${prefix}${Math.round(current).toLocaleString("en-IN")}${suffix}`;
      setDisplay(formatted);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value); // ensure exact final value
        prevNumRef.current = targetNum;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration, prefix, suffix]);

  return (
    <span className={`tabular-nums ${className}`} style={{ fontVariantNumeric: "tabular-nums" }}>
      {display}
    </span>
  );
});
