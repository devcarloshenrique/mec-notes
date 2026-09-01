import React, { useState, useEffect, useRef, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { X, Eye, Pencil, Plus, MoreHorizontal, Copy, Check } from "lucide-react";
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

  // Carregar dados da nota do SQLite com fallback imediato e timeout de segurança
  useEffect(() => {
    let isMounted = true;
    const fetchNote = async () => {
      try {
        // Timeout de segurança de 3 segundos para evitar travamento infinito no IPC
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
          } else {
            // Nota ainda não gravada ou criada dinamicamente
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
        // Fallback local seguro para que a UI nunca fique travada ou preta
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

  // Foco automático ao entrar no modo de edição de título
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Fechar dropdown de menu ao clicar fora
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

  // Função de salvar no SQLite
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
        setNote(saved);
      } catch (err) {
        console.error("Erro ao salvar nota adesiva:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [noteId, note]
  );

  // Auto-save com debounce de 400ms
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

  // Criar uma nova nota adesiva
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

  // Copiar conteúdo da nota
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
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#141415] text-foreground select-none ring-1 ring-white/[0.06] shadow-2xl">
      {/* Barra Superior / Header Neutro Minimalista com Região de Arrasto Nativa Fluida */}
      <header
        data-tauri-drag-region
        className="flex h-8 shrink-0 select-none items-center justify-between border-b border-white/[0.06] bg-[#0d0d0e] px-2 cursor-move"
      >
        {/* Esquerda: Botão de Adicionar Nova Nota */}
        <button
          onClick={handleCreateNewNote}
          aria-label="Nova nota adesiva"
          title="Nova nota adesiva"
          className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-white/[0.08] hover:text-foreground transition-colors cursor-pointer"
        >
          <Plus className="size-3.5" />
        </button>

        {/* Centro: Título da Nota / Área de Arraste Ampla */}
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
              className="no-drag w-full max-w-[180px] bg-white/[0.06] px-1.5 py-0.5 rounded text-center text-[11px] font-medium text-foreground outline-none ring-1 ring-white/20 truncate cursor-text"
            />
          ) : (
            <span
              data-tauri-drag-region
              onDoubleClick={() => setIsEditingTitle(true)}
              title="Duplo-clique para renomear"
              className="text-[11px] font-medium text-foreground/70 truncate text-center select-none max-w-[200px] cursor-move"
            >
              {title || "Nota Adesiva"}
            </span>
          )}
        </div>

        {/* Direita: Menu de Elipse + Botão Fechar */}
        <div className="flex items-center gap-0.5 shrink-0 cursor-default">
          {/* Indicador sutil de salvamento */}
          {isSaving && (
            <span className="text-[9px] text-muted-foreground/60 mr-1 animate-pulse pointer-events-none">
              Salvando...
            </span>
          )}

          {/* Botão de Elipse (Menu de Opções) */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-label="Mais opções"
              title="Mais opções"
              className={`grid size-6 place-items-center rounded text-muted-foreground transition-colors cursor-pointer ${
                isMenuOpen
                  ? "bg-white/[0.12] text-foreground"
                  : "hover:bg-white/[0.08] hover:text-foreground"
              }`}
            >
              <MoreHorizontal className="size-3.5" />
            </button>

            {/* Dropdown Menu Flutuante */}
            {isMenuOpen && (
              <div className="no-drag absolute right-0 top-full mt-1 w-44 rounded-lg border border-white/[0.08] bg-[#1a1a1c]/95 backdrop-blur-md p-1 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
                {/* Opção: Renomear */}
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsEditingTitle(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-foreground/80 hover:bg-white/[0.08] hover:text-foreground transition-colors text-left"
                >
                  <Pencil className="size-3 text-muted-foreground" />
                  <span>Renomear</span>
                </button>

                {/* Opção: Alternar Modo Edição / Preview */}
                <button
                  onClick={() => {
                    setTab((prev) => (prev === "edit" ? "preview" : "edit"));
                    setIsMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-foreground/80 hover:bg-white/[0.08] hover:text-foreground transition-colors text-left"
                >
                  {tab === "edit" ? (
                    <>
                      <Eye className="size-3 text-muted-foreground" />
                      <span>Visualizar Markdown</span>
                    </>
                  ) : (
                    <>
                      <Pencil className="size-3 text-muted-foreground" />
                      <span>Editar Conteúdo</span>
                    </>
                  )}
                </button>

                <div className="my-1 h-px bg-white/[0.06]" />

                {/* Opção: Copiar Conteúdo */}
                <button
                  onClick={handleCopyContent}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-foreground/80 hover:bg-white/[0.08] hover:text-foreground transition-colors text-left"
                >
                  {hasCopied ? (
                    <>
                      <Check className="size-3 text-emerald-400" />
                      <span className="text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3 text-muted-foreground" />
                      <span>Copiar conteúdo</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Botão Fechar */}
          <button
            onClick={handleClose}
            aria-label="Fechar nota adesiva"
            title="Fechar nota adesiva"
            className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </header>

      {/* Conteúdo da Nota Adesiva */}
      <main className="flex-1 overflow-y-auto bg-[#141415]">
        {tab === "edit" ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleBlur}
            spellCheck={false}
            placeholder="Digite suas anotações aqui em Markdown…"
            className="h-full w-full resize-none bg-transparent p-3 font-mono text-[12px] leading-relaxed text-foreground/90 outline-none placeholder:text-muted-foreground/40"
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
