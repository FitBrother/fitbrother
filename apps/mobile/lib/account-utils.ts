export function profileInitials(name: string | null, email: string | null): string {
  if (!name && !email) return "FB";
  return (name || email || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function exportFilename(contentDisposition: string | null): string {
  return contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1] ?? "fitbrother-export.zip";
}
