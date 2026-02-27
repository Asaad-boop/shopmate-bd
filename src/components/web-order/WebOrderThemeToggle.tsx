import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WebOrderThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 w-7 p-0 rounded-md"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? (
        <Sun className="w-3.5 h-3.5" />
      ) : (
        <Moon className="w-3.5 h-3.5" />
      )}
    </Button>
  );
}
