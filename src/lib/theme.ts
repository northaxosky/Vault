/** Read the current theme from the cookie. Falls back to "dark". */
export function getCurrentTheme(): "dark" | "light" {
  if (typeof document === "undefined") return "dark";
  const match = document.cookie.match(/(?:^|;\s*)theme=(\w+)/);
  return (match?.[1] as "dark" | "light") ?? "dark";
}

/** Set a specific theme. Updates cookie + DOM class. */
export function setTheme(theme: "dark" | "light"): void {
  document.cookie = `theme=${theme};path=/;max-age=${60 * 60 * 24 * 365}`;
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}
