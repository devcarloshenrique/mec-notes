import React, { useState, useEffect, useRef, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { X, Eye, PencilSimple, Plus, DotsThree, Copy, Check } from "@phosphor-icons/react";
import { dbService, Note } from "../services/db";
import { MarkdownPreview } from "./MarkdownPreview";

interface StickyNoteViewProps {
  noteId: string;
}

export const StickyNoteView: React.FC<StickyNoteViewProps> = ({ noteId }) => {
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("Nota Adesiva");
  const [content, setContent] = useState("");
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMountRef = useRef<boolean>(true);
  const geometryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isClosingRef = useRef<boolean>(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const lastSavedAtRef = useRef<string>("");

  // Carregar dados da nota do SQLite
  useEffect(() => {
    let isMounted = true;
    const fetchNote = async () => {
      try {
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout ao carregar nota")), 3000)
        );
        const data = await Promise.race([
          dbService.getNoteById(noteId),
          timeoutPromise,
        ]);

        if (isMounted) {
          if (data) {
            setNote(data);
            setTitle(data.title || "Nota Adesiva");
            setContent(data.content || "");
            lastSavedAtRef.current = data.updated_at || "";
          } else {
            const newNote: Note = {
              id: noteId,
              title: "Nota Adesiva",
              content: "",
              tags: [],
              is_pinned: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            try {
              const saved = await dbService.saveNote(newNote);
              if (isMounted) {
                setNote(saved);
                setTitle(saved.title);
                setContent(saved.content);
                lastSavedAtRef.current = saved.updated_at || "";
              }
            } catch {
              if (isMounted) {
                setNote(newNote);
              }
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar nota adesiva:", err);
        if (isMounted) {
          setNote({
            id: noteId,
            title: "Nota Adesiva",
            content: "",
            tags: [],
            is_pinned: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      } finally {
        if (isMounted) {
          isInitialMountRef.current = true;
        }
      }
    };

    fetchNote();
    return () => {
      isMounted = false;
    };
  }, [noteId]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    let unlistenUpdated: (() => void) | null = null;
    let unlistenDeleted: (() => void) | null = null;
    let isDisposed = false;

    const setupEventListeners = async () => {
      try {
        const uUpdated = await listen<Note>("note-updated", (event) => {
          if (isDisposed || isClosingRef.current) return;
          const incoming = event.payload;
          if (!incoming || incoming.id !== noteId) return;

          if (incoming.updated_at !== lastSavedAtRef.current) {
            lastSavedAtRef.current = incoming.updated_at;
            setNote(incoming);
            setTitle(incoming.title || "Nota Adesiva");
            setContent(incoming.content || "");
          }
        });

        const uDeleted = await listen<string>("note-deleted", (event) => {
          if (isDisposed || isClosingRef.current) return;
          const deletedId = event.payload;
          if (deletedId === noteId) {
            isClosingRef.current = true;
            getCurrentWindow().close().catch(() => {});
          }
        });

        if (isDisposed) {
          uUpdated();
          uDeleted();
        } else {
          unlistenUpdated = uUpdated;
          unlistenDeleted = uDeleted;
        }
      } catch (err) {
        console.error("Erro ao configurar listeners de sincronização no StickyNoteView:", err);
      }
    };

    setupEventListeners();

    return () => {
      isDisposed = true;
      if (unlistenUpdated) unlistenUpdated();
      if (unlistenDeleted) unlistenDeleted();
    };
  }, [noteId]);

  const handleSave = useCallback(
    async (updatedTitle: string, updatedContent: string) => {
      if (!noteId) return;
      try {
        setIsSaving(true);
        const now = new Date().toISOString();
        const updated: Note = {
          id: noteId,
          title: updatedTitle.trim() || "Nota Adesiva",
          content: updatedContent,
          tags: note?.tags || [],
          is_pinned: note?.is_pinned || false,
          created_at: note?.created_at || now,
          updated_at: now,
        };
        const saved = await dbService.saveNote(updated);
        lastSavedAtRef.current = saved.updated_at;
        setNote(saved);
      } catch (err) {
        console.error("Erro ao salvar nota adesiva:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [noteId, note]
  );

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

  const handleCreateNewNote = async () => {
    try {
      const newId = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "sticky-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      
      const newNote: Note = {
        id: newId,
        title: "Nova Nota",
        content: "",
        tags: [],
        is_pinned: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await dbService.saveNote(newNote);
      await dbService.openStickyNote(newId);
    } catch (err) {
      console.error("Erro ao criar nova nota adesiva:", err);
    }
  };

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
      setIsMenuOpen(false);
    } catch (err) {
      console.error("Erro ao copiar conteúdo:", err);
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

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    handleBlur();
  };

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-app-editor text-app-text select-none border border-app-border shadow-2xl">
      {/* Barra Superior */}
      <header
        data-tauri-drag-region
        className="flex h-8 shrink-0 select-none items-center justify-between border-b border-app-border bg-app-dark px-2 cursor-move"
      >
        <button
          onClick={handleCreateNewNote}
          aria-label="Nova nota adesiva"
          title="Nova nota adesiva"
          className="grid size-6 shrink-0 place-items-center rounded text-app-icon hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          <Plus className="text-sm" />
        </button>

        <div
          data-tauri-drag-region
          className="flex-1 min-w-0 px-2 flex items-center justify-center cursor-move"
        >
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTitleSubmit();
                if (e.key === "Escape") {
                  setTitle(note?.title || "Nota Adesiva");
                  setIsEditingTitle(false);
                }
              }}
              placeholder="Nota Adesiva"
              className="no-drag w-full max-w-[180px] bg-zinc-800 px-1.5 py-0.5 rounded text-center text-[11px] font-medium text-white outline-none ring-1 ring-white/20 truncate cursor-text"
            />
          ) : (
            <span
              data-tauri-drag-region
              onDoubleClick={() => setIsEditingTitle(true)}
              title="Duplo-clique para renomear"
              className="text-[11px] font-medium text-app-muted truncate text-center select-none max-w-[200px] cursor-move hover:text-white transition-colors"
            >
              {title || "Nota Adesiva"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0 cursor-default">
          {isSaving && (
            <span className="text-[9px] text-app-muted mr-1 animate-pulse pointer-events-none">
              Salvando...
            </span>
          )}

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-label="Mais opções"
              title="Mais opções"
              className={`grid size-6 place-items-center rounded text-app-icon transition-colors cursor-pointer ${
                isMenuOpen
                  ? "bg-white/10 text-white"
                  : "hover:bg-white/10 hover:text-white"
              }`}
            >
              <DotsThree className="text-base font-bold" weight="bold" />
            </button>

            {isMenuOpen && (
              <div className="no-drag absolute right-0 top-full mt-1 w-44 rounded-lg border border-app-border bg-app-sidebar/95 backdrop-blur-md p-1 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 text-app-text">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsEditingTitle(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  <PencilSimple className="text-xs text-app-muted" />
                  <span>Renomear</span>
                </button>

                <button
                  onClick={() => {
                    setTab((prev) => (prev === "edit" ? "preview" : "edit"));
                    setIsMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  {tab === "edit" ? (
                    <>
                      <Eye className="text-xs text-app-muted" />
                      <span>Visualizar Markdown</span>
                    </>
                  ) : (
                    <>
                      <PencilSimple className="text-xs text-app-muted" />
                      <span>Editar Conteúdo</span>
                    </>
                  )}
                </button>

                <div className="my-1 h-px bg-app-border" />

                <button
                  onClick={handleCopyContent}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] hover:bg-white/10 hover:text-white transition-colors text-left"
                >
                  {hasCopied ? (
                    <>
                      <Check className="text-xs text-emerald-400" weight="bold" />
                      <span className="text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="text-xs text-app-muted" />
                      <span>Copiar conteúdo</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleClose}
            aria-label="Fechar nota adesiva"
            title="Fechar nota adesiva"
            className="grid size-6 place-items-center rounded text-app-icon hover:bg-red-500/15 hover:text-red-400 transition-colors cursor-pointer"
          >
            <X className="text-sm" />
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 min-h-0 overflow-hidden bg-app-editor">
        {tab === "edit" ? (
          <div className="h-full w-full p-3 flex flex-col min-h-0 overflow-hidden">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={handleBlur}
              spellCheck={false}
              placeholder="Digite suas anotações aqui em Markdown…"
              className="editor-textarea flex-1 w-full h-full resize-none overflow-y-auto bg-transparent font-mono text-[12px] leading-relaxed text-app-text outline-none placeholder:text-zinc-600 p-0 border-none focus:ring-0"
              autoFocus
            />
          </div>
        ) : (
          <div className="h-full w-full overflow-y-auto p-3 text-[12px] text-app-text">
            <MarkdownPreview source={content} />
          </div>
        )}
      </main>
    </div>
  );
};
