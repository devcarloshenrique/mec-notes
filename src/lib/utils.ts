import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelative(iso: string): string {
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "agora";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const min = Math.round(diffMs / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `há ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `há ${h} h`;
    const d = Math.round(h / 24);
    return `há ${d} d`;
  } catch {
    return "agora";
  }
}
