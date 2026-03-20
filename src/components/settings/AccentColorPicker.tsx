"use client";

import { useCallback, useRef } from "react";

// Preset colors with their hue values
const presets = [
  { label: "Cyan", hue: 195 },
  { label: "Teal", hue: 160 },
  { label: "Emerald", hue: 145 },
  { label: "Blue", hue: 220 },
  { label: "Purple", hue: 270 },
  { label: "Pink", hue: 340 },
  { label: "Orange", hue: 30 },
  { label: "Red", hue: 0 },
];

interface AccentColorPickerProps {
  currentHue: number;
  onHueChange: (hue: number) => void;
}

export default function AccentColorPicker({
  currentHue,
  onHueChange,
}: AccentColorPickerProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Apply the hue instantly to the DOM (live preview),
  // then debounce the API call to persist it.
  const handleChange = useCallback(
    (hue: number) => {
      // Instant visual update — no page reload needed
      document.documentElement.style.setProperty("--accent-hue", String(hue));
      onHueChange(hue);

      // Debounce the save to the server (300ms after last change)
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          await fetch("/api/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accentHue: hue }),
          });
        } catch (err) {
          console.error("Failed to save accent color:", err);
        }
      }, 300);
    },
    [onHueChange]
  );

  return (
    <div className="space-y-4">
      {/* Hue slider with spectrum gradient */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Hue</span>
          <span className="text-sm font-medium text-foreground">{currentHue}°</span>
        </div>
        <input
          type="range"
          min={0}
          max={360}
          value={currentHue}
          onChange={(e) => handleChange(Number(e.target.value))}
          className="w-full h-3 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right,
              oklch(0.75 0.15 0),
              oklch(0.75 0.15 60),
              oklch(0.75 0.15 120),
              oklch(0.75 0.15 180),
              oklch(0.75 0.15 240),
              oklch(0.75 0.15 300),
              oklch(0.75 0.15 360)
            )`,
          }}
        />
      </div>

      {/* Preset color buttons */}
      <div>
        <span className="text-sm text-muted-foreground">Presets</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.hue}
              onClick={() => handleChange(preset.hue)}
              title={preset.label}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-all ${
                currentHue === preset.hue
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "hover:ring-1 hover:ring-border"
              }`}
              style={{
                backgroundColor: `oklch(0.75 0.15 ${preset.hue} / 20%)`,
                color: `oklch(0.75 0.15 ${preset.hue})`,
              }}
            >
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: `oklch(0.75 0.15 ${preset.hue})` }}
              />
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
