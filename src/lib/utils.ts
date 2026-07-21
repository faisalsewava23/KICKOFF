import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 700 → "£7", 852 → "£8.52"
export function formatPence(pence: number): string {
  const pounds = pence / 100;
  return `£${pounds % 1 === 0 ? pounds : pounds.toFixed(2)}`;
}

// Validate a post-login destination: must be a relative path ("/games/abc"),
// never an absolute or scheme-relative URL — prevents open-redirect abuse.
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

// "Jamie Carragher" → "JC", "jamie" → "J"
export function initials(nameOrEmail: string): string {
  const clean = nameOrEmail.split("@")[0].trim();
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
