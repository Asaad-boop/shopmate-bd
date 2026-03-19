import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isTyping =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target as HTMLElement).isContentEditable;

      // Always allow Escape
      if (e.key === "Escape") {
        setShowHelp(false);
        return;
      }

      // Don't fire shortcuts when typing
      if (isTyping) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case "/":
          e.preventDefault();
          document.querySelector<HTMLButtonElement>("[data-global-search]")?.click();
          break;
        case "?":
          e.preventDefault();
          setShowHelp((v) => !v);
          break;
        case "d":
        case "D":
          e.preventDefault();
          navigate("/");
          break;
        case "o":
        case "O":
          e.preventDefault();
          navigate("/orders/all");
          break;
        case "p":
        case "P":
          e.preventDefault();
          navigate("/products");
          break;
        case "f":
        case "F":
          e.preventDefault();
          navigate("/finance");
          break;
        case "c":
        case "C":
          e.preventDefault();
          navigate("/crm");
          break;
        case "n":
        case "N":
          e.preventDefault();
          navigate("/orders/new");
          break;
      }
    },
    [navigate]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp };
}
