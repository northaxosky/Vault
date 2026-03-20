"use client";

import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import AccentColorPicker from "./AccentColorPicker";

interface AppearanceSettingsProps {
  settings: {
    accentHue: number;
  };
}

export default function AppearanceSettings({
  settings,
}: AppearanceSettingsProps) {
  const [hue, setHue] = useState(settings.accentHue);

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
            <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 ring-2 ring-primary">
              <span className="text-sm font-medium text-primary">Dark</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 opacity-50">
              <span className="text-sm text-muted-foreground">Light (Coming Never LMAO)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
