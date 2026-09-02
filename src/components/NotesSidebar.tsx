import React, { useState, useEffect, useRef } from "react";
import {
  SidebarSimple,
  MagnifyingGlass,
  Plus,
  PushPin,
  Gear,
  Trash,
  Warning,
  NotePencil,
} from "@phosphor-icons/react";
import { formatRelative } from "../lib/utils";
import { Note } from "../services/db";

type Props = {
  notes: Note[];
  activeId: string | null;
  query: string;
  onQueryChange: (q: string) => void;
  onSelect: (note: Note) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onTogglePin?: (note: Note) => void;
  onOpenSticky?: (note: Note) => void;
  onToggleSidebar?: () => void;
  onOpenSettings?: () => void;
};

interface ContextMenuState {
  x: number;
  y: number;
  note: Note;
}

export const NotesSidebar: React.FC<Props> = ({
  notes,
  activeId,
  query,
  onQueryChange,
  onSelect,
  onCreate,
  onDelete,
  onTogglePin,
  onOpenSticky,
  onToggleSidebar,
  onOpenSettings,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  // Fechar menu de contexto ao clicar fora ou pressionar ESC
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent, note: Note) => {
    e.preventDefault();
    e.stopPropagation();

    // Ajustar posição para manter dentro da janela
    const clickX = e.clientX;
    const clickY = e.clientY;
    const menuWidth = 200;
    const menuHeight = 120;

    const x =
      clickX + menuWidth > window.innerWidth ? window.innerWidth - menuWidth - 8 : clickX;
    const y =
      clickY + menuHeight > window.innerHeight ? window.innerHeight - menuHeight - 8 : clickY;

    setContextMenu({
      x,
      y,
      note,
    });
  };

  const filtered = notes.filter((n) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      (n.title && n.title.toLowerCase().includes(q)) ||
      (n.content && n.content.toLowerCase().includes(q)) ||
      (n.tags && n.tags.some((t) => t.toLowerCase().includes(q)))
    );
  });

  const sorted = [...filtered].sort(
    (a, b) => Number(!!b.is_pinned) - Number(!!a.is_pinned)
  );

  const confirmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    setContextMenu(null);
  };

  const handleExecuteDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDelete(id);
    setDeletingId(null);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(null);
  };

  const handlePinClick = (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    if (onTogglePin) {
      onTogglePin(note);
    }
  };

  return (
    <aside className="w-72 bg-app-sidebar border-r border-app-border flex flex-col shrink-0 h-full select-none">
      {/* Header Sidebar com Botão de Recolher e Área de Arraste */}
      <div
        data-tauri-drag-region
        className="h-10 border-b border-app-border flex items-center justify-between px-3 shrink-0 select-none bg-app-dark cursor-move"
      >
        <div className="flex items-center gap-2 pointer-events-none pl-1" data-tauri-drag-region>
          <span className="font-semibold text-xs tracking-wider text-app-muted uppercase">Notas</span>
        </div>
        <div className="flex items-center gap-1 text-app-icon text-sm cursor-default">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              title="Ocultar barra lateral (Ctrl+B)"
              className="hover:text-app-text transition-colors flex items-center gap-1.5 p-1.5 rounded hover:bg-white/5"
            >
              <SidebarSimple className="text-lg" />
            </button>
          )}
        </div>
      </div>

      {/* Busca e Botão Criar Nova Nota */}
      <div className="p-3.5 flex gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted text-lg pointer-events-none" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="w-full bg-app-dark border border-app-border rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500 transition-colors text-app-text placeholder:text-app-muted"
            placeholder="Buscar notas"
            type="text"
          />
        </div>
        <button
          onClick={onCreate}
          aria-label="Nova Nota"
          title="Nova Nota (Ctrl+N)"
          className="bg-white text-black rounded-lg w-9 h-9 flex items-center justify-center hover:bg-zinc-200 transition-colors shrink-0 shadow-sm"
        >
          <Plus className="text-lg font-bold" weight="bold" />
        </button>
      </div>

      {/* Contador de Notas */}
      <div className="px-4 pb-2 text-[11px] font-semibold text-app-muted tracking-wider uppercase">
        {sorted.length} {sorted.length === 1 ? "Nota" : "Notas"}
      </div>

      {/* Lista de Notas com Scroll */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
        {sorted.length === 0 ? (
          <div className="py-8 text-center text-xs text-app-muted">
            {query ? "Nenhuma nota encontrada" : "Nenhuma nota ainda"}
          </div>
        ) : (
          sorted.map((note) => {
            const active = note.id === activeId;
            const isDeleting = deletingId === note.id;
            const preview = (note.content || "")
              .replace(/[#>*`\-[\]]/g, "")
              .replace(/\n+/g, " ")
              .trim();

            if (isDeleting) {
              return (
                <div
                  key={note.id}
                  className="p-3 rounded-lg bg-destructive/15 border border-destructive/40"
                >
                  <div className="flex items-center gap-1.5 text-xs text-destructive font-medium mb-1.5">
                    <Warning className="text-sm shrink-0" weight="fill" />
                    <span>Excluir esta nota?</span>
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={handleCancelDelete}
                      className="px-2 py-0.5 text-[11px] bg-zinc-800 hover:bg-zinc-700 text-app-text rounded transition"
                    >
                      Não
                    </button>
                    <button
                      onClick={(e) => handleExecuteDelete(e, note.id)}
                      className="px-2 py-0.5 text-[11px] bg-destructive text-white rounded font-medium transition"
                    >
                      Sim
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <button
                key={note.id}
                onClick={() => onSelect(note)}
                onContextMenu={(e) => handleContextMenu(e, note)}
                className={`w-full text-left rounded-lg p-2.5 transition-colors group relative ${
                  active
                    ? "bg-app-active"
                    : "hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  {note.is_pinned && (
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Desafixar nota do topo"
                      title="Desafixar do topo"
                      onClick={(e) => handlePinClick(e, note)}
                      className="shrink-0"
                    >
                      <PushPin
                        weight="fill"
                        className="text-app-text text-sm cursor-pointer hover:opacity-80"
                      />
                    </span>
                  )}
                  <h3
                    className={`font-medium text-sm text-app-text truncate flex-1 ${
                      !note.is_pinned ? "pl-0.5" : ""
                    }`}
                  >
                    {note.title.trim() || "Nova nota"}
                  </h3>

                  {/* Ações rápidas ao passar o mouse */}
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {onOpenSticky && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="Fixar na área de trabalho"
                        title="Fixar na área de trabalho"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenSticky(note);
                        }}
                        className="text-app-muted hover:text-white p-0.5 rounded cursor-pointer transition-colors"
                      >
                        <NotePencil className="text-sm" />
                      </span>
                    )}
                    {onTogglePin && !note.is_pinned && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="Fixar nota no topo"
                        title="Fixar no topo"
                        onClick={(e) => handlePinClick(e, note)}
                        className="text-app-muted hover:text-white p-0.5 rounded cursor-pointer transition-colors"
                      >
                        <PushPin className="text-sm" />
                      </span>
                    )}
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Excluir nota"
                      title="Excluir nota"
                      onClick={(e) => confirmDelete(e, note.id)}
                      className="text-app-muted hover:text-red-400 p-0.5 rounded cursor-pointer transition-colors"
                    >
                      <Trash className="text-sm" />
                    </span>
                  </div>
                </div>

                <p className="text-xs text-app-muted truncate pl-0.5">
                  {preview || "Vazio"}
                </p>
                <p className="text-[11px] text-app-muted mt-0.5 opacity-70 pl-0.5">
                  {formatRelative(note.updated_at)}
                </p>
              </button>
            );
          })
        )}
      </div>

      {/* Footer com Botão de Configurações */}
      <div className="h-10 border-t border-app-border flex items-center px-3 shrink-0 bg-app-dark">
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            title="Configurações"
            className="text-app-icon hover:text-app-text transition-colors p-1.5 rounded hover:bg-white/5 flex items-center justify-center"
          >
            <Gear className="text-lg opacity-75 hover:opacity-100" />
          </button>
        )}
      </div>

      {/* Menu de Contexto Flutuante (Clique Direito) */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 min-w-[180px] overflow-hidden rounded-lg border border-app-border bg-app-sidebar p-1.5 text-app-text shadow-2xl backdrop-blur animate-in fade-in-80"
        >
          {onOpenSticky && (
            <button
              onClick={() => {
                onOpenSticky(contextMenu.note);
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-white/10 hover:text-white"
            >
              <NotePencil className="text-sm text-app-muted" />
              <span>Fixar na área de trabalho</span>
            </button>
          )}

          {onTogglePin && (
            <button
              onClick={() => {
                onTogglePin(contextMenu.note);
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-white/10 hover:text-white"
            >
              <PushPin className="text-sm text-app-muted" />
              <span>{contextMenu.note.is_pinned ? "Desafixar do topo" : "Fixar no topo"}</span>
            </button>
          )}

          <div className="my-1 h-px bg-app-border" />

          <button
            onClick={(e) => confirmDelete(e, contextMenu.note.id)}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-red-400 transition-colors hover:bg-red-500/15"
          >
            <Trash className="text-sm" />
            <span>Excluir nota</span>
          </button>
        </div>
      )}
    </aside>
  );
};
