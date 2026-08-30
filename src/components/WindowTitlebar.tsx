import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Maximize2, Minimize2, Minus, PanelLeft, Settings, X } from "lucide-react";

type Props = {
  mode: "floating" | "window";
  onToggleMode: () => void;
  onOpenSettings: () => void;
  onMinimize: () => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
};

export const WindowTitlebar: React.FC<Props> = ({
  mode,
  onToggleMode,
  onOpenSettings,
  onMinimize,
  onToggleSidebar,
  isSidebarOpen = true,
}) => {
  const handleMouseDown = async (e: React.MouseEvent) => {
    // Só aciona o arrasto no botão esquerdo e se o alvo não for um elemento clicável (botão/link)
    if (e.button === 0) {
      const target = e.target as HTMLElement;
      if (
        target.tagName !== "BUTTON" &&
        !target.closest("button") &&
        target.getAttribute("role") !== "button"
      ) {
        try {
          await getCurrentWindow().startDragging();
        } catch (err) {
          console.error("Erro ao iniciar arrasto:", err);
        }
      }
    }
  };

  return (
    <header
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
      className="flex h-10 shrink-0 select-none items-center justify-between border-b border-border bg-card/60 pl-3 pr-2 backdrop-blur cursor-move"
    >
      {/* Lado Esquerdo: Apenas a Logo */}
      <div className="flex items-center pointer-events-none pl-1">
        <img
          src="/logo_native.png"
          alt="MEC Notes Logo"
          className="h-[16px] w-auto select-none opacity-80"
          draggable={false}
        />
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
          className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Fechar para a bandeja"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </header>
  );
};
