import React, { useState, useEffect, useRef } from "react";
import { Pin, Plus, Search, Trash2, AlertTriangle, StickyNote } from "lucide-react";
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
    const menuWidth = 190;
    const menuHeight = 110;

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
    <aside className="relative flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar h-full overflow-hidden">
      {/* Cabeçalho da Sidebar com Input e Botão Criar */}
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar notas"
            className="w-full rounded-md border border-sidebar-border bg-background/40 py-1.5 pl-8 pr-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
          />
        </div>
        <button
          onClick={onCreate}
          aria-label="Nova nota"
          className="grid size-[30px] shrink-0 place-items-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
        </button>
      </div>

      {/* Contador de Notas */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {sorted.length} nota{sorted.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Lista de Notas */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        <ul className="space-y-0.5">
          {sorted.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
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
                  <li key={note.id} className="p-2 rounded-md bg-destructive/15 border border-destructive/40">
                    <div className="flex items-center gap-1.5 text-xs text-destructive font-medium mb-1.5">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      <span>Excluir esta nota?</span>
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={handleCancelDelete}
                        className="px-2 py-0.5 text-[11px] bg-muted hover:bg-accent text-foreground rounded transition"
                      >
                        Não
                      </button>
                      <button
                        onClick={(e) => handleExecuteDelete(e, note.id)}
                        className="px-2 py-0.5 text-[11px] bg-destructive text-destructive-foreground rounded font-medium transition"
                      >
                        Sim
                      </button>
                    </div>
                  </li>
                );
              }

              return (
                <li key={note.id}>
                  <button
                    onClick={() => onSelect(note)}
                    onContextMenu={(e) => handleContextMenu(e, note)}
                    className={`group flex w-full flex-col gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors ${
                      active
                        ? "border-white/10 bg-accent"
                        : "border-transparent hover:border-sidebar-border hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {note.is_pinned && (
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="Desafixar nota do topo"
                          title="Desafixar do topo"
                          onClick={(e) => handlePinClick(e, note)}
                        >
                          <Pin className="size-3 shrink-0 fill-primary text-primary cursor-pointer hover:opacity-80" />
                        </span>
                      )}
                      <span className="flex-1 truncate text-[13px] font-medium text-foreground">
                        {note.title.trim() || "Sem título"}
                      </span>
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
                            className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                          >
                            <StickyNote className="size-3" />
                          </span>
                        )}
                        {onTogglePin && !note.is_pinned && (
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label="Fixar nota no topo"
                            title="Fixar no topo"
                            onClick={(e) => handlePinClick(e, note)}
                            className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                          >
                            <Pin className="size-3" />
                          </span>
                        )}
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="Excluir nota"
                          title="Excluir nota"
                          onClick={(e) => confirmDelete(e, note.id)}
                          className="text-muted-foreground hover:text-destructive cursor-pointer transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                        </span>
                      </div>
                    </div>
                    <span className="truncate text-[11px] text-muted-foreground w-full">
                      {preview || "Vazio"}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">
                      {formatRelative(note.updated_at)}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </nav>

      {/* Menu de Contexto Flutuante (Clique Direito) */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 min-w-[170px] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl backdrop-blur animate-in fade-in-80"
        >
          {onOpenSticky && (
            <button
              onClick={() => {
                onOpenSticky(contextMenu.note);
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent hover:text-foreground"
            >
              <StickyNote className="size-3.5 text-muted-foreground" />
              <span>Fixar na área de trabalho</span>
            </button>
          )}

          {onTogglePin && (
            <button
              onClick={() => {
                onTogglePin(contextMenu.note);
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent hover:text-foreground"
            >
              <Pin className="size-3.5 text-muted-foreground" />
              <span>{contextMenu.note.is_pinned ? "Desafixar do topo" : "Fixar no topo"}</span>
            </button>
          )}

          <div className="my-1 h-px bg-border" />

          <button
            onClick={(e) => confirmDelete(e, contextMenu.note.id)}
            className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-xs text-destructive transition-colors hover:bg-destructive/15"
          >
            <Trash2 className="size-3.5" />
            <span>Excluir nota</span>
          </button>
        </div>
      )}
    </aside>
  );
};

