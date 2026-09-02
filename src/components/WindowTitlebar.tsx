import React from "react";
import { Minus, Square, X, SidebarSimple } from "@phosphor-icons/react";
import { Note } from "../services/db";

type Props = {
  mode: "floating" | "window";
  activeNote: Note | null;
  onUpdateTitle: (newTitle: string) => void;
  onToggleMode: () => void;
  onMinimize: () => void;
  onCloseToTray: () => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
};

export const WindowTitlebar: React.FC<Props> = ({
  mode,
  activeNote,
  onUpdateTitle,
  onToggleMode,
  onMinimize,
  onCloseToTray,
  onToggleSidebar,
  isSidebarOpen = true,
}) => {
  return (
    <header
      data-tauri-drag-region
      className="h-10 border-b border-app-border flex items-center justify-between px-3 shrink-0 select-none bg-app-dark cursor-move"
    >
      {/* Lado Esquerdo: Botão Sidebar (se fechada) + Logo (se fechada) + Título da Nota Ativa */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {!isSidebarOpen && (
          <div className="flex items-center gap-1.5 shrink-0">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                title="Mostrar barra lateral (Ctrl+B)"
                className="hover:text-app-text text-app-icon transition-colors flex items-center p-1.5 rounded hover:bg-white/5 cursor-pointer"
              >
                <SidebarSimple className="text-lg" />
              </button>
            )}
            <img
              src="/logo_native.png"
              alt="MEC Notes Logo"
              className="h-4 w-auto select-none opacity-90 pointer-events-none ml-0.5"
              draggable={false}
            />
          </div>
        )}

        {activeNote ? (
          <input
            value={activeNote.title}
            onChange={(e) => onUpdateTitle(e.target.value)}
            placeholder="Título da nota"
            className="bg-transparent text-sm font-medium text-white border-none focus:ring-0 p-0 truncate min-w-[150px] flex-1 outline-none cursor-text ml-1"
          />
        ) : (
          <span className="text-sm font-medium text-app-muted pointer-events-none ml-1">
            Nenhuma nota selecionada
          </span>
        )}
      </div>

      {/* Lado Direito: Apenas os Controles da Janela (Minimizar, Maximizar/Modo Janela, Fechar) */}
      <div className="flex items-center gap-1 text-app-icon text-sm cursor-default">
        <button
          onClick={onMinimize}
          title="Minimizar"
          className="hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-md cursor-pointer"
        >
          <Minus className="text-sm" />
        </button>
        <button
          onClick={onToggleMode}
          title={mode === "floating" ? "Expandir / Modo Janela" : "Modo Flutuante"}
          className="hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-md cursor-pointer"
        >
          <Square className="text-sm" />
        </button>
        <button
          onClick={onCloseToTray}
          title="Fechar para a bandeja"
          className="hover:text-red-500 transition-colors p-1.5 hover:bg-red-500/10 rounded-md cursor-pointer"
        >
          <X className="text-sm" />
        </button>
      </div>
    </header>
  );
};
