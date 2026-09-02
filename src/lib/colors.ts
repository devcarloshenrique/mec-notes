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
    borderPreview: "border-white/10",
    shadowPreview: "shadow-2xl",
    borderActive: "border-white/20",
    shadowActive: "shadow-[0_0_20px_rgba(255,255,255,0.08)]",
    textAccent: "text-white",
    textAccentLight: "text-zinc-300",
    badgeClass: "bg-zinc-500",
    borderClass: "border-white/20",
    glowClass: "shadow-[0_0_20px_rgba(255,255,255,0.08)]",
    titleClass: "text-white",
  },
  {
    id: "cyan",
    name: "Ciano",
    dotClass: "bg-[#06b6d4]",
    accentHex: "#06b6d4",
    borderPreview: "border-[#3b82f6]/45",
    shadowPreview: "shadow-[0_0_15px_rgba(59,130,246,0.18)] hover:shadow-[0_0_22px_rgba(59,130,246,0.28)]",
    borderActive: "border-[#06b6d4]/70",
    shadowActive: "shadow-[0_0_26px_rgba(6,182,212,0.45)]",
    textAccent: "text-[#22d3ee]",
    textAccentLight: "text-[#93c5fd]",
    badgeClass: "bg-[#06b6d4]",
    borderClass: "border-[#06b6d4]/70",
    glowClass: "shadow-[0_0_26px_rgba(6,182,212,0.45)]",
    titleClass: "text-[#22d3ee]",
  },
  {
    id: "green",
    name: "Verde",
    dotClass: "bg-[#10b981]",
    accentHex: "#10b981",
    borderPreview: "border-[#10b981]/45",
    shadowPreview: "shadow-[0_0_15px_rgba(16,185,129,0.18)] hover:shadow-[0_0_22px_rgba(16,185,129,0.28)]",
    borderActive: "border-[#10b981]/70",
    shadowActive: "shadow-[0_0_26px_rgba(16,185,129,0.45)]",
    textAccent: "text-[#6ee7b7]",
    textAccentLight: "text-[#6ee7b7]",
    badgeClass: "bg-[#10b981]",
    borderClass: "border-[#10b981]/70",
    glowClass: "shadow-[0_0_26px_rgba(16,185,129,0.45)]",
    titleClass: "text-[#6ee7b7]",
  },
  {
    id: "amber",
    name: "Âmbar",
    dotClass: "bg-[#f59e0b]",
    accentHex: "#f59e0b",
    borderPreview: "border-[#f59e0b]/45",
    shadowPreview: "shadow-[0_0_15px_rgba(245,158,11,0.18)] hover:shadow-[0_0_22px_rgba(245,158,11,0.28)]",
    borderActive: "border-[#f59e0b]/70",
    shadowActive: "shadow-[0_0_26px_rgba(245,158,11,0.45)]",
    textAccent: "text-[#fcd34d]",
    textAccentLight: "text-[#fcd34d]",
    badgeClass: "bg-[#f59e0b]",
    borderClass: "border-[#f59e0b]/70",
    glowClass: "shadow-[0_0_26px_rgba(245,158,11,0.45)]",
    titleClass: "text-[#fcd34d]",
  },
  {
    id: "purple",
    name: "Violeta",
    dotClass: "bg-[#8b5cf6]",
    accentHex: "#8b5cf6",
    borderPreview: "border-[#8b5cf6]/45",
    shadowPreview: "shadow-[0_0_15px_rgba(139,92,246,0.18)] hover:shadow-[0_0_22px_rgba(139,92,246,0.28)]",
    borderActive: "border-[#8b5cf6]/70",
    shadowActive: "shadow-[0_0_26px_rgba(139,92,246,0.45)]",
    textAccent: "text-[#c4b5fd]",
    textAccentLight: "text-[#c4b5fd]",
    badgeClass: "bg-[#8b5cf6]",
    borderClass: "border-[#8b5cf6]/70",
    glowClass: "shadow-[0_0_26px_rgba(139,92,246,0.45)]",
    titleClass: "text-[#c4b5fd]",
  },
  {
    id: "rose",
    name: "Rosa",
    dotClass: "bg-[#ec4899]",
    accentHex: "#ec4899",
    borderPreview: "border-[#f43f5e]/45",
    shadowPreview: "shadow-[0_0_15px_rgba(244,63,94,0.18)] hover:shadow-[0_0_22px_rgba(244,63,94,0.28)]",
    borderActive: "border-[#ec4899]/70",
    shadowActive: "shadow-[0_0_26px_rgba(236,72,153,0.45)]",
    textAccent: "text-[#fda4af]",
    textAccentLight: "text-[#fda4af]",
    badgeClass: "bg-[#ec4899]",
    borderClass: "border-[#ec4899]/70",
    glowClass: "shadow-[0_0_26px_rgba(236,72,153,0.45)]",
    titleClass: "text-[#fda4af]",
  },
];

export function getNoteColor(colorId?: string): NoteColorOption {
  if (colorId === "blue") {
    const cyan = NOTE_COLORS.find((c) => c.id === "cyan");
    if (cyan) return cyan;
  }
  const found = NOTE_COLORS.find((c) => c.id === colorId);
  return found || NOTE_COLORS[0];
}
