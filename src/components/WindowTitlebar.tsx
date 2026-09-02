import React from "react";
import { Minus, Square, X, SidebarSimple, PushPin, NotePencil } from "@phosphor-icons/react";
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
  onTogglePin?: (note: Note) => void;
  onOpenSticky?: (note: Note) => void;
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
  onTogglePin,
  onOpenSticky,
}) => {
  return (
    <header
      data-tauri-drag-region
      className="h-10 border-b border-app-border flex items-center justify-between px-3 shrink-0 select-none bg-app-dark cursor-move"
    >
      {/* Lado Esquerdo: Botão Sidebar (se fechada) + Título da Nota Ativa */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {!isSidebarOpen && onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            title="Mostrar barra lateral (Ctrl+B)"
            className="hover:text-app-text text-app-icon transition-colors flex items-center p-1.5 rounded hover:bg-white/5"
          >
            <SidebarSimple className="text-lg" />
          </button>
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

      {/* Lado Direito: Ações da Nota e Controles da Janela */}
      <div className="flex items-center gap-3 text-app-icon text-sm cursor-default">
        {activeNote && (
          <div className="flex items-center gap-1">
            {onOpenSticky && (
              <button
                onClick={() => onOpenSticky(activeNote)}
                title="Fixar na área de trabalho"
                className="hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-md"
              >
                <NotePencil className="text-sm" />
              </button>
            )}
            {onTogglePin && (
              <button
                onClick={() => onTogglePin(activeNote)}
                title={activeNote.is_pinned ? "Desafixar do topo" : "Fixar no topo"}
                className={`transition-colors p-1.5 hover:bg-white/10 rounded-md ${
                  activeNote.is_pinned ? "text-white" : "hover:text-white"
                }`}
              >
                <PushPin
                  weight={activeNote.is_pinned ? "fill" : "regular"}
                  className="text-sm"
                />
              </button>
            )}
          </div>
        )}

        <div className="w-px h-3.5 bg-app-border"></div>

        {/* Controles da Janela (Minimizar, Maximizar/Modo Janela, Fechar) */}
        <div className="flex items-center gap-1">
          <button
            onClick={onMinimize}
            title="Minimizar"
            className="hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-md"
          >
            <Minus className="text-sm" />
          </button>
          <button
            onClick={onToggleMode}
            title={mode === "floating" ? "Expandir / Modo Janela" : "Modo Flutuante"}
            className="hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-md"
          >
            <Square className="text-sm" />
          </button>
          <button
            onClick={onCloseToTray}
            title="Fechar para a bandeja"
            className="hover:text-red-500 transition-colors p-1.5 hover:bg-red-500/10 rounded-md"
          >
            <X className="text-sm" />
          </button>
        </div>
      </div>
    </header>
  );
};
