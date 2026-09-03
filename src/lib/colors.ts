export interface NoteColorOption {
  id: string;
  name: string;
  dotClass: string;
  accentHex: string;
  borderPreview: string;
  shadowPreview: string;
  borderActive: string;
  shadowActive: string;
  textAccent: string;
  textAccentLight: string;
  badgeClass: string;
  // Compatibilidade com código existente
  borderClass: string;
  glowClass: string;
  titleClass: string;
}

export const NOTE_COLORS: NoteColorOption[] = [
  {
    id: "default",
    name: "Padrão",
    dotClass: "bg-zinc-400",
    accentHex: "#a1a1aa",
    borderPreview: "border-white/20",
    shadowPreview: "shadow-[0_0_16px_rgba(255,255,255,0.12)] hover:shadow-[0_0_22px_rgba(255,255,255,0.2)]",
    borderActive: "border-white/40",
    shadowActive: "shadow-[0_0_26px_rgba(255,255,255,0.2)]",
    textAccent: "text-white",
    textAccentLight: "text-zinc-300",
    badgeClass: "bg-zinc-500",
    borderClass: "border-white/40",
    glowClass: "shadow-[0_0_26px_rgba(255,255,255,0.2)]",
    titleClass: "text-white",
  },
  {
    id: "cyan",
    name: "Ciano",
    dotClass: "bg-[#06b6d4]",
    accentHex: "#06b6d4",
    borderPreview: "border-[#06b6d4]/60",
    shadowPreview: "shadow-[0_0_18px_rgba(6,182,212,0.3)] hover:shadow-[0_0_24px_rgba(6,182,212,0.45)]",
    borderActive: "border-[#06b6d4]",
    shadowActive: "shadow-[0_0_30px_rgba(6,182,212,0.65)]",
    textAccent: "text-[#22d3ee]",
    textAccentLight: "text-[#93c5fd]",
    badgeClass: "bg-[#06b6d4]",
    borderClass: "border-[#06b6d4]",
    glowClass: "shadow-[0_0_30px_rgba(6,182,212,0.65)]",
    titleClass: "text-[#22d3ee]",
  },
  {
    id: "green",
    name: "Verde",
    dotClass: "bg-[#10b981]",
    accentHex: "#10b981",
    borderPreview: "border-[#10b981]/60",
    shadowPreview: "shadow-[0_0_18px_rgba(16,185,129,0.3)] hover:shadow-[0_0_24px_rgba(16,185,129,0.45)]",
    borderActive: "border-[#10b981]",
    shadowActive: "shadow-[0_0_30px_rgba(16,185,129,0.65)]",
    textAccent: "text-[#6ee7b7]",
    textAccentLight: "text-[#6ee7b7]",
    badgeClass: "bg-[#10b981]",
    borderClass: "border-[#10b981]",
    glowClass: "shadow-[0_0_30px_rgba(16,185,129,0.65)]",
    titleClass: "text-[#6ee7b7]",
  },
  {
    id: "amber",
    name: "Âmbar",
    dotClass: "bg-[#f59e0b]",
    accentHex: "#f59e0b",
    borderPreview: "border-[#f59e0b]/60",
    shadowPreview: "shadow-[0_0_18px_rgba(245,158,11,0.3)] hover:shadow-[0_0_24px_rgba(245,158,11,0.45)]",
    borderActive: "border-[#f59e0b]",
    shadowActive: "shadow-[0_0_30px_rgba(245,158,11,0.65)]",
    textAccent: "text-[#fcd34d]",
    textAccentLight: "text-[#fcd34d]",
    badgeClass: "bg-[#f59e0b]",
    borderClass: "border-[#f59e0b]",
    glowClass: "shadow-[0_0_30px_rgba(245,158,11,0.65)]",
    titleClass: "text-[#fcd34d]",
  },
  {
    id: "purple",
    name: "Violeta",
    dotClass: "bg-[#8b5cf6]",
    accentHex: "#8b5cf6",
    borderPreview: "border-[#8b5cf6]/60",
    shadowPreview: "shadow-[0_0_18px_rgba(139,92,246,0.3)] hover:shadow-[0_0_24px_rgba(139,92,246,0.45)]",
    borderActive: "border-[#8b5cf6]",
    shadowActive: "shadow-[0_0_30px_rgba(139,92,246,0.65)]",
    textAccent: "text-[#c4b5fd]",
    textAccentLight: "text-[#c4b5fd]",
    badgeClass: "bg-[#8b5cf6]",
    borderClass: "border-[#8b5cf6]",
    glowClass: "shadow-[0_0_30px_rgba(139,92,246,0.65)]",
    titleClass: "text-[#c4b5fd]",
  },
  {
    id: "rose",
    name: "Rosa",
    dotClass: "bg-[#ec4899]",
    accentHex: "#ec4899",
    borderPreview: "border-[#ec4899]/60",
    shadowPreview: "shadow-[0_0_18px_rgba(236,72,153,0.3)] hover:shadow-[0_0_24px_rgba(236,72,153,0.45)]",
    borderActive: "border-[#ec4899]",
    shadowActive: "shadow-[0_0_30px_rgba(236,72,153,0.65)]",
    textAccent: "text-[#fda4af]",
    textAccentLight: "text-[#fda4af]",
    badgeClass: "bg-[#ec4899]",
    borderClass: "border-[#ec4899]",
    glowClass: "shadow-[0_0_30px_rgba(236,72,153,0.65)]",
    titleClass: "text-[#fda4af]",
  },
];

export function getNoteColor(colorId?: string): NoteColorOption {
  if (!colorId) return NOTE_COLORS[1]; // default cyan
  const normalized = colorId.toLowerCase().trim();
  if (normalized === "blue" || normalized === "cyan") {
    return NOTE_COLORS.find((c) => c.id === "cyan") || NOTE_COLORS[1];
  }
  if (normalized === "emerald" || normalized === "green") {
    return NOTE_COLORS.find((c) => c.id === "green") || NOTE_COLORS[2];
  }
  if (normalized === "violet" || normalized === "purple") {
    return NOTE_COLORS.find((c) => c.id === "purple") || NOTE_COLORS[4];
  }
  const found = NOTE_COLORS.find((c) => c.id === normalized);
  return found || NOTE_COLORS[0];
}
