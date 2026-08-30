import React from "react";
import { Maximize2, Minimize2, Minus, PanelLeft, Settings, X } from "lucide-react";

type Props = {
  mode: "floating" | "window";
  onToggleMode: () => void;
  onOpenSettings: () => void;
  onMinimize: () => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  saveState: "saved" | "saving" | "unsaved";
};

export const WindowTitlebar: React.FC<Props> = ({
  mode,
  onToggleMode,
  onOpenSettings,
  onMinimize,
  onToggleSidebar,
  isSidebarOpen = true,
  saveState,
}) => {
  return (
    <header
      data-tauri-drag-region
      className="flex h-10 shrink-0 select-none items-center justify-between border-b border-border bg-card/60 pl-3 pr-2 backdrop-blur cursor-move"
    >
      {/* Lado Esquerdo: Logo, Título e Status de Auto-save */}
      <div className="flex items-center gap-2 pointer-events-none">
        <span className="grid size-5 place-items-center rounded-[5px] bg-primary text-[11px] font-bold text-primary-foreground select-none">
          M
        </span>
        <span className="text-[13px] font-semibold tracking-tight text-foreground">
          MEC Notes
        </span>
        <span className="ml-1 hidden items-center gap-1.5 rounded-full border border-border px-2 py-0.5 sm:flex">
          <span
            className={`size-1.5 rounded-full ${
              saveState === "saving"
                ? "bg-primary animate-pulse"
                : saveState === "unsaved"
                ? "bg-amber-400 animate-pulse"
                : "bg-emerald-400"
            }`}
            aria-hidden
          />
          <span className="text-[10px] text-muted-foreground">
            {saveState === "saving"
              ? "Salvando…"
              : saveState === "unsaved"
              ? "Alterações pendentes"
              : "Salvo automaticamente"}
          </span>
        </span>
      </div>

      {/* Lado Direito: Ações e Controles */}
      <div className="flex items-center gap-0.5 cursor-default">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={`grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${
              !isSidebarOpen ? "opacity-60" : ""
            }`}
            title={isSidebarOpen ? "Ocultar barra lateral" : "Mostrar barra lateral"}
          >
            <PanelLeft className="size-3.5" />
          </button>
        )}

        <button
          onClick={onToggleMode}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title={mode === "floating" ? "Alternar para Modo Janela" : "Alternar para Modo Flutuante"}
        >
          {mode === "floating" ? (
            <Maximize2 className="size-3.5" />
          ) : (
            <Minimize2 className="size-3.5" />
          )}
          <span className="hidden sm:inline">
            {mode === "floating" ? "Modo Janela" : "Modo Flutuante"}
          </span>
        </button>

        <button
          onClick={onOpenSettings}
          aria-label="Configurações"
          className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Configurações"
        >
          <Settings className="size-4" />
        </button>

        <div className="mx-1 h-4 w-px bg-border" aria-hidden />

        {/* Controles de Janela do SO */}
        <button
          onClick={onMinimize}
          aria-label="Minimizar para a bandeja"
          className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Minimizar para a bandeja"
        >
          <Minus className="size-3.5" />
        </button>

        <button
          onClick={onMinimize}
          aria-label="Ocultar para a bandeja"
          className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive hover:text-primary-foreground"
          title="Fechar para a bandeja"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </header>
  );
};
