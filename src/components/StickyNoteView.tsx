import React, { useState, useEffect, useRef, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { X, Eye, Pencil, Pin } from "lucide-react";
import { dbService, Note } from "../services/db";
import { MarkdownPreview } from "./MarkdownPreview";

interface StickyNoteViewProps {
  noteId: string;
}

export const StickyNoteView: React.FC<StickyNoteViewProps> = ({ noteId }) => {
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMountRef = useRef<boolean>(true);
  const geometryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isClosingRef = useRef<boolean>(false);

  // Carregar dados da nota do SQLite
  useEffect(() => {
    let isMounted = true;
    const fetchNote = async () => {
      try {
        setLoading(true);
        const data = await dbService.getNoteById(noteId);
        if (isMounted) {
          if (data) {
            setNote(data);
            setTitle(data.title || "");
            setContent(data.content || "");
          } else {
            // Nota não encontrada ou criada na hora
            const newNote: Note = {
              id: noteId,
              title: "Nota Adesiva",
              content: "",
              tags: [],
              is_pinned: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            const saved = await dbService.saveNote(newNote);
            setNote(saved);
            setTitle(saved.title);
            setContent(saved.content);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar nota adesiva:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
          isInitialMountRef.current = true;
        }
      }
    };

    fetchNote();
    return () => {
      isMounted = false;
    };
  }, [noteId]);

  // Função de salvar no SQLite
  const handleSave = useCallback(
    async (updatedTitle: string, updatedContent: string) => {
      if (!noteId) return;
      try {
        setIsSaving(true);
        const now = new Date().toISOString();
        const updated: Note = {
          id: noteId,
          title: updatedTitle,
          content: updatedContent,
          tags: note?.tags || [],
          is_pinned: note?.is_pinned || false,
          created_at: note?.created_at || now,
          updated_at: now,
        };
        const saved = await dbService.saveNote(updated);
        setNote(saved);
      } catch (err) {
        console.error("Erro ao salvar nota adesiva:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [noteId, note]
  );

  // Auto-save com debounce de 400ms conforme requisito
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    if (!note) return;

    const hasChanged = title !== note.title || content !== note.content;
    if (hasChanged) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        handleSave(title, content);
      }, 400);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [title, content, note, handleSave]);

  // Capturar e salvar geometria (posição e tamanho) da janela com debounce
  useEffect(() => {
    let unlistenResize: (() => void) | null = null;
    let unlistenMove: (() => void) | null = null;
    let isDisposed = false;

    const setupGeometryListeners = async () => {
      try {
        const currentWin = getCurrentWindow();

        const saveGeometry = () => {
          if (isDisposed || isClosingRef.current) return;
          if (geometryTimerRef.current) {
            clearTimeout(geometryTimerRef.current);
          }

          geometryTimerRef.current = setTimeout(async () => {
            if (isDisposed || isClosingRef.current) return;
            try {
              const [pos, size, scale] = await Promise.all([
                currentWin.outerPosition(),
                currentWin.innerSize(),
                currentWin.scaleFactor(),
              ]);

              if (isDisposed || isClosingRef.current) return;

              const logicalPos = pos.toLogical(scale);
              const logicalSize = size.toLogical(scale);

              await dbService.saveStickyGeometry(
                noteId,
                logicalPos.x,
                logicalPos.y,
                logicalSize.width,
                logicalSize.height
              );
            } catch (err) {
              console.error("Erro ao persistir geometria da janela adesiva:", err);
            }
          }, 350);
        };

        const resFn = await currentWin.onResized(() => {
          saveGeometry();
        });
        if (isDisposed) {
          resFn();
        } else {
          unlistenResize = resFn;
        }

        const moveFn = await currentWin.onMoved(() => {
          saveGeometry();
        });
        if (isDisposed) {
          moveFn();
        } else {
          unlistenMove = moveFn;
        }
      } catch (err) {
        console.error("Erro ao configurar listeners de geometria:", err);
      }
    };

    setupGeometryListeners();

    return () => {
      isDisposed = true;
      if (geometryTimerRef.current) {
        clearTimeout(geometryTimerRef.current);
        geometryTimerRef.current = null;
      }
      if (unlistenResize) unlistenResize();
      if (unlistenMove) unlistenMove();
    };
  }, [noteId]);

  // Fechar a nota adesiva de forma segura e sem concorrência
  const handleClose = async () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    try {
      if (geometryTimerRef.current) {
        clearTimeout(geometryTimerRef.current);
        geometryTimerRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (note && (title !== note.title || content !== note.content)) {
        await handleSave(title, content);
      }
      await dbService.closeStickyNote(noteId);
    } catch (err) {
      console.error("Erro ao fechar nota adesiva via IPC:", err);
      try {
        await getCurrentWindow().close();
      } catch (e) {
        console.error("Erro ao forçar fechamento da janela:", e);
      }
    }
  };

  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.button === 0) {
      const target = e.target as HTMLElement;
      if (
        target.tagName !== "BUTTON" &&
        target.tagName !== "INPUT" &&
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

  const handleBlur = () => {
    if (!note) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (title !== note.title || content !== note.content) {
      handleSave(title, content);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-card text-xs text-muted-foreground select-none">
        Carregando nota adesiva...
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-card text-foreground select-none border border-border/80 shadow-2xl">
      {/* Barra Superior / Header Neutro Minimalista com Região de Arrasto */}
      <header
        data-tauri-drag-region
        onMouseDown={handleMouseDown}
        className="flex h-8 shrink-0 select-none items-center justify-between border-b border-border bg-sidebar px-2.5 cursor-move"
      >
        {/* Título inline / Arrastável */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
          <Pin className="size-3 shrink-0 text-muted-foreground/80 fill-muted-foreground/30" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleBlur}
            placeholder="Nota Adesiva"
            className="w-full bg-transparent text-[12px] font-medium text-foreground outline-none placeholder:text-muted-foreground truncate cursor-text"
          />
        </div>

        {/* Ações e Controles */}
        <div className="flex items-center gap-1 cursor-default shrink-0">
          {/* Indicador sutil de salvamento */}
          {isSaving && (
            <span className="text-[10px] text-muted-foreground mr-1 animate-pulse">
              Salvando...
            </span>
          )}

          {/* Toggle Edição / Preview */}
          <div className="flex items-center rounded-md border border-border/60 bg-background/50 p-0.5">
            <button
              onClick={() => setTab("edit")}
              className={`flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                tab === "edit"
                  ? "bg-accent text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Modo Edição"
            >
              <Pencil className="size-2.5" />
            </button>
            <button
              onClick={() => setTab("preview")}
              className={`flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                tab === "preview"
                  ? "bg-accent text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Modo Preview"
            >
              <Eye className="size-2.5" />
            </button>
          </div>

          <div className="mx-0.5 h-3.5 w-px bg-border/60" aria-hidden />

          {/* Botão Fechar */}
          <button
            onClick={handleClose}
            aria-label="Fechar nota adesiva"
            title="Fechar nota adesiva"
            className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </header>

      {/* Conteúdo da Nota Adesiva */}
      <main className="flex-1 overflow-y-auto bg-card">
        {tab === "edit" ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleBlur}
            spellCheck={false}
            placeholder="Digite suas anotações aqui em Markdown…"
            className="h-full w-full resize-none bg-transparent p-3 font-mono text-[12px] leading-relaxed text-foreground/90 outline-none placeholder:text-muted-foreground"
            autoFocus
          />
        ) : (
          <div className="p-3 text-[12px]">
            <MarkdownPreview source={content} />
          </div>
        )}
      </main>
    </div>
  );
};
