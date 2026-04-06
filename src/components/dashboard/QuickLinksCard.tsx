"use client";

import { useEffect, useState } from "react";

interface QuickLink {
  id: string;
  label: string;
  url: string;
  icon: string | null;
  sortOrder: number;
}

interface FormState {
  mode: "add" | "edit";
  id?: string;
  icon: string;
  label: string;
  url: string;
}

const EMPTY_FORM: FormState = { mode: "add", icon: "🔗", label: "", url: "" };

export default function QuickLinksCard() {
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/quick-links")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load quick links");
        return res.json();
      })
      .then((data) => setLinks(data.links))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!form || !form.label.trim() || !form.url.trim()) return;

    setSaving(true);
    try {
      if (form.mode === "add") {
        const res = await fetch("/api/quick-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: form.label.trim(),
            url: form.url.trim(),
            icon: form.icon || null,
            sortOrder: links.length,
          }),
        });
        if (!res.ok) throw new Error("Failed to create link");
        const { link } = await res.json();
        setLinks((prev) => [...prev, link]);
      } else {
        const res = await fetch("/api/quick-links", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: form.id,
            label: form.label.trim(),
            url: form.url.trim(),
            icon: form.icon || null,
          }),
        });
        if (!res.ok) throw new Error("Failed to update link");
        const { link } = await res.json();
        setLinks((prev) => prev.map((l) => (l.id === link.id ? link : l)));
      }
      setForm(null);
    } catch {
      setError("Failed to save link");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch("/api/quick-links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to delete link");
      setLinks((prev) => prev.filter((l) => l.id !== id));
      setConfirmDelete(null);
    } catch {
      setError("Failed to delete link");
    }
  }

  if (loading) {
    return (
      <div className="glass rounded-xl p-6 animate-pulse">
        <div className="h-4 w-28 bg-muted rounded mb-4" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error && links.length === 0) {
    return (
      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          Quick Links
        </h3>
        <p className="text-sm text-muted-foreground">
          Unable to load quick links
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        Quick Links
      </h3>

      {/* Inline form for add/edit */}
      {form && (
        <div className="mb-4 space-y-2 rounded-lg border border-border/50 bg-card/50 p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              className="w-14 rounded-md border border-border bg-background px-2 py-1.5 text-center text-lg focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="🔗"
              maxLength={10}
            />
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Label"
              maxLength={50}
            />
          </div>
          <input
            type="url"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="https://..."
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setForm(null)}
              className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.label.trim() || !form.url.trim()}
              className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {links.length === 0 && !form && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Add shortcuts to your favorite financial sites
          </p>
          <button
            onClick={() => setForm({ ...EMPTY_FORM })}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl text-primary hover:bg-primary/20 transition-colors"
            aria-label="Add new quick link"
          >
            +
          </button>
        </div>
      )}

      {/* Link grid */}
      {links.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {links.map((link) => (
            <div key={link.id} className="group relative">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 rounded-lg p-3 transition-colors hover:bg-white/5"
              >
                <span className="text-2xl">{link.icon || "🔗"}</span>
                <span className="text-xs text-muted-foreground truncate w-full text-center">
                  {link.label}
                </span>
              </a>

              {/* Hover actions */}
              <div className="absolute top-1 right-1 hidden gap-0.5 group-hover:flex">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setForm({
                      mode: "edit",
                      id: link.id,
                      icon: link.icon || "🔗",
                      label: link.label,
                      url: link.url,
                    });
                    setConfirmDelete(null);
                  }}
                  className="rounded p-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title="Edit"
                  aria-label={`Edit ${link.label}`}
                >
                  ✏️
                </button>
                {confirmDelete === link.id ? (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete(link.id);
                    }}
                    className="rounded px-1 py-0.5 text-[10px] font-medium text-red-400 hover:text-red-300 transition-colors"
                  >
                    Confirm?
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setConfirmDelete(link.id);
                    }}
                    className="rounded p-0.5 text-xs text-muted-foreground hover:text-red-400 transition-colors"
                    title="Delete"
                    aria-label={`Delete ${link.label}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Add button */}
          {!form && (
            <button
              onClick={() => {
                setForm({ ...EMPTY_FORM });
                setConfirmDelete(null);
              }}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/50 p-3 transition-colors hover:bg-white/5"
              aria-label="Add new quick link"
            >
              <span className="text-2xl text-muted-foreground">+</span>
              <span className="text-xs text-muted-foreground">Add</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
