"use client";

import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import AccentColorPicker from "./AccentColorPicker";
import { Moon, Sun } from "lucide-react";
import { getCurrentTheme, setTheme as applyTheme } from "@/lib/theme";

interface AppearanceSettingsProps {
  settings: {
    accentHue: number;
  };
}

export default function AppearanceSettings({
  settings,
}: AppearanceSettingsProps) {
  const [hue, setHue] = useState(settings.accentHue);

  const [theme, setTheme] = useState(getCurrentTheme);

  const toggleTheme = (newTheme: "dark" | "light") => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-lg font-semibold text-foreground">Appearance</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Customize how Vault looks
      </p>

      <Separator className="my-4" />

      <div className="space-y-6">
        {/* Accent Color */}
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">
            Accent Color
          </h4>
          <AccentColorPicker currentHue={hue} onHueChange={setHue} />
        </div>

        <Separator />

        {/* Theme Mode */}
        <div>
          <h4 className="text-sm font-medium text-foreground">Theme Mode</h4>
          <div className="mt-3 flex gap-3">
            <button
              onClick={() => toggleTheme("dark")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${
                theme === "dark"
                  ? "bg-primary/10 ring-2 ring-primary"
                  : "bg-secondary hover:bg-secondary/80"
              }`}
            >
              <Moon className={`h-4 w-4 ${theme === "dark" ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-sm font-medium ${theme === "dark" ? "text-primary" : "text-muted-foreground"}`}>
                Dark
              </span>
            </button>
            <button
              onClick={() => toggleTheme("light")}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${
                theme === "light"
                  ? "bg-primary/10 ring-2 ring-primary"
                  : "bg-secondary hover:bg-secondary/80"
              }`}
            >
              <Sun className={`h-4 w-4 ${theme === "light" ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-sm font-medium ${theme === "light" ? "text-primary" : "text-muted-foreground"}`}>
                Light
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
