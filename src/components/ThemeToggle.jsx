import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";
  return (
    <Button
      variant="outline"
      size="icon"
      data-testid="theme-toggle-button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label="Ganti tema"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
