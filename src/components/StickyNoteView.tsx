import React, { useState, useEffect, useRef, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import {
  X,
  Check,
  TextB,
  TextUnderline,
  TextStrikethrough,
  ListBullets,
  ImageSquare,
  Archive,
  DotsSixVertical,
} from "@phosphor-icons/react";
import { dbService, Note } from "../services/db";
import { NOTE_COLORS, getNoteColor } from "../lib/colors";
import { MarkdownPreview } from "./MarkdownPreview";

interface StickyNoteViewProps {
  noteId: string;
}

const getNeonStyle = (hex: string, isEditing: boolean) => {
  if (!hex || hex === "#a1a1aa") {
    return {
      boxShadow: isEditing
        ? "0 0 10px rgba(255,255,255,0.4), 0 0 20px rgba(255,255,255,0.15), inset 0 0 8px rgba(255,255,255,0.1)"
        : "0 0 6px rgba(255,255,255,0.25), 0 0 12px rgba(255,255,255,0.1), inset 0 0 4px rgba(255,255,255,0.05)",
      borderColor: isEditing ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)",
    };
  }
  return {
    boxShadow: isEditing
      ? `0 0 10px ${hex}80, 0 0 22px ${hex}40, inset 0 0 10px ${hex}26`
      : `0 0 6px ${hex}55, 0 0 14px ${hex}26, inset 0 0 6px ${hex}1a`,
    borderColor: isEditing ? hex : `${hex}cc`,
  };
};

export const StickyNoteView: React.FC<StickyNoteViewProps> = ({ noteId }) => {
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("Sem título");
  const [category, setCategory] = useState("Geral");
  const [content, setContent] = useState("");
  const [color, setColor] = useState<string>("cyan");
  const [isSaving, setIsSaving] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(true);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMountRef = useRef<boolean>(true);
  const geometryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isClosingRef = useRef<boolean>(false);
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef<number>(0);
  const lastSavedAtRef = useRef<string>("");
  const isDraggingRef = useRef<boolean>(false);

  // Sincronizar posição de rolagem vertical ao alternar entre preview e edição
  useEffect(() => {
    if (isEditing) {
      if (textareaRef.current) {
        textareaRef.current.scrollTop = lastScrollTopRef.current;
      }
    } else {
      if (previewRef.current) {
        previewRef.current.scrollTop = lastScrollTopRef.current;
      }
    }
  }, [isEditing]);

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
            setTitle(data.title || "Sem título");
            setCategory(data.tags && data.tags.length > 0 ? data.tags[0] : "Geral");
            setContent(data.content || "");
            setColor(data.color === "blue" ? "cyan" : data.color || "cyan");
            lastSavedAtRef.current = data.updated_at || "";
          } else {
            const newNote: Note = {
              id: noteId,
              title: "Sem título",
              content: "",
              tags: ["Geral"],
              is_pinned: false,
              color: "cyan",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            try {
              const saved = await dbService.saveNote(newNote);
              if (isMounted) {
                setNote(saved);
                setTitle(saved.title);
                setCategory("Geral");
                setContent(saved.content);
                setColor(saved.color || "cyan");
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
            title: "Sem título",
            content: "",
            tags: ["Geral"],
            is_pinned: false,
            color: "cyan",
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

  // Click outside para paleta
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (paletteRef.current && !paletteRef.current.contains(target)) {
        setIsPaletteOpen(false);
      }
    };

    if (isPaletteOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPaletteOpen]);

  // Alternância entre modo de Edição (selecionada) e Preview (ao clicar fora)
  useEffect(() => {
    let unlistenFocus: (() => void) | null = null;
    let isDisposed = false;

    const setupFocusListeners = async () => {
      try {
        const win = getCurrentWindow();
        unlistenFocus = await win.onFocusChanged(({ payload: focused }) => {
          if (isDisposed) return;
          if (isDraggingRef.current) return;
          if (!focused) {
            setIsEditing(false);
            setIsPaletteOpen(false);
          }
        });
      } catch (err) {
        console.error("Erro ao escutar foco da janela da nota adesiva:", err);
      }
    };

    setupFocusListeners();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsEditing(false);
        setIsPaletteOpen(false);
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      isDisposed = true;
      if (unlistenFocus) unlistenFocus();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Sincronização em tempo real via eventos Tauri
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
            setTitle(incoming.title || "Sem título");
            setCategory(incoming.tags && incoming.tags.length > 0 ? incoming.tags[0] : "Geral");
            setContent(incoming.content || "");
            setColor(incoming.color === "blue" ? "cyan" : incoming.color || "cyan");
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
        console.error("Erro ao sincronizar eventos no StickyNoteView:", err);
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
    async (
      updatedTitle?: string,
      updatedContent?: string,
      updatedColor?: string,
      updatedCategory?: string
    ) => {
      if (!noteId) return;
      try {
        setIsSaving(true);
        const now = new Date().toISOString();
        const finalColor = updatedColor !== undefined ? updatedColor : (note?.color || color || "cyan");
        const finalCategory = updatedCategory !== undefined ? updatedCategory : category;
        const finalContent = updatedContent !== undefined ? updatedContent : content;
        const firstLine = finalContent.split("\n")[0].replace(/^#+\s*/, "").trim();
        const finalTitle =
          updatedTitle !== undefined && updatedTitle !== "Sem título"
            ? updatedTitle.trim()
            : (title && title !== "Sem título" ? title : (firstLine || "Sem título"));

        const updated: Note = {
          id: noteId,
          title: finalTitle,
          content: finalContent,
          tags: finalCategory ? [finalCategory] : [],
          is_pinned: note?.is_pinned || false,
          color: finalColor,
          created_at: note?.created_at || now,
          updated_at: now,
        };
        const saved = await dbService.saveNote(updated);
        lastSavedAtRef.current = saved.updated_at;
        setNote(saved);
        setColor(saved.color || "cyan");
        setTitle(saved.title || "Sem título");
      } catch (err) {
        console.error("Erro ao salvar nota adesiva:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [noteId, note, color, category, content, title]
  );

  // Auto-save debounced para content
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    if (!note) return;

    const hasChanged = content !== note.content;
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
  }, [content, note, title, handleSave]);

  // Salvar imediatamente ao alternar de edição para preview
  useEffect(() => {
    if (!isEditing && note) {
      if (title !== note.title || content !== note.content) {
        handleSave(title, content);
      }
    }
  }, [isEditing, note, title, content, handleSave]);

  // Persistência da geometria da janela
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
              console.error("Erro ao salvar geometria da janela:", err);
            }
          }, 350);
        };

        const resFn = await currentWin.onResized(() => saveGeometry());
        if (isDisposed) resFn();
        else unlistenResize = resFn;

        const moveFn = await currentWin.onMoved(() => saveGeometry());
        if (isDisposed) moveFn();
        else unlistenMove = moveFn;
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
      await getCurrentWindow().close();
    } catch (err) {
      console.error("Erro ao fechar nota adesiva:", err);
      try {
        await getCurrentWindow().close();
      } catch (e) {
        console.error("Erro ao forçar fechamento da janela:", e);
      }
    }
  };

  const handleColorSelect = async (newColorId: string) => {
    setColor(newColorId);
    setIsPaletteOpen(false);
    await handleSave(title, content, newColorId);
  };

  const handleArchive = async () => {
    try {
      await dbService.deleteNote(noteId);
      await handleClose();
    } catch (err) {
      console.error("Erro ao arquivar/excluir nota:", err);
    }
  };

  const triggerImageUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const md = `\n![${file.name}](${reader.result})\n`;
        const textarea = textareaRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newContent = content.substring(0, start) + md + content.substring(end);
          setContent(newContent);
          handleSave(title, newContent);
        } else {
          const newContent = content + md;
          setContent(newContent);
          handleSave(title, newContent);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // Inserção de snippets Markdown no textarea
  const insertMdSnippet = (type: "bold" | "underline" | "strike" | "list") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);

    let insertion = "";
    let cursorOffset = 0;

    switch (type) {
      case "bold":
        insertion = selected ? `**${selected}**` : "**texto**";
        cursorOffset = selected ? insertion.length : 2;
        break;
      case "underline":
        insertion = selected ? `<u>${selected}</u>` : "<u>texto</u>";
        cursorOffset = selected ? insertion.length : 3;
        break;
      case "strike":
        insertion = selected ? `~~${selected}~~` : "~~texto~~";
        cursorOffset = selected ? insertion.length : 2;
        break;
      case "list":
        insertion = `\n- ${selected || "item"}\n`;
        cursorOffset = insertion.length;
        break;
    }

    const newContent = content.substring(0, start) + insertion + content.substring(end);
    setContent(newContent);
    handleSave(title, newContent);

    setTimeout(() => {
      textarea.focus();
      const pos = selected ? start + insertion.length : start + cursorOffset;
      textarea.setSelectionRange(pos, selected ? pos : pos + (type === "list" ? 4 : 5));
    }, 0);
  };
  const handleResizeMouseDown = (direction: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (getCurrentWindow() as any).startResizeDragging(direction).catch(() => {});
    } catch {
      // no-op
    }
  };

  const handleEnterEdit = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest(".no-drag") ||
      target.closest("[data-tauri-drag-region]")
    ) {
      return;
    }

    // Se o clique ocorreu na área da barra de rolagem vertical (scrollbar track ou thumb)
    if (previewRef.current) {
      const pRect = previewRef.current.getBoundingClientRect();
      if (
        e.clientX >= pRect.left + previewRef.current.clientWidth &&
        e.clientX <= pRect.right + 4
      ) {
        e.stopPropagation();
        return;
      }
    }

    const currentTarget = e.currentTarget as HTMLElement;
    if (currentTarget && currentTarget.clientWidth) {
      const rect = currentTarget.getBoundingClientRect();
      if (
        e.clientX >= rect.left + currentTarget.clientWidth &&
        e.clientX <= rect.right + 4
      ) {
        e.stopPropagation();
        return;
      }
    }

    if (!isEditing) {
      setIsEditing(true);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.scrollTop = lastScrollTopRef.current;
          textareaRef.current.focus();
        }
      }, 50);
    }
  };

  const handleStartDrag = (e: React.MouseEvent) => {
    if (e.button === 0) {
      const target = e.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest(".no-drag") ||
        target.closest("[data-tauri-drag-region='false']")
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      isDraggingRef.current = true;
      getCurrentWindow()
        .startDragging()
        .catch((err) => {
          console.error("Erro ao arrastar janela:", err);
        })
        .finally(() => {
          setTimeout(() => {
            isDraggingRef.current = false;
          }, 150);
        });
    }
  };

  const activeColor = getNoteColor(color);

  return (
    <div className="relative w-full h-full p-2.5 flex flex-col bg-transparent select-none">
      {/* Alças de Redimensionamento Nativo nas 4 bordas e 4 cantos da Janela (no padding transparente externo) */}
      <div
        onMouseDown={handleResizeMouseDown("North")}
        className="absolute top-0 left-3 right-3 h-2.5 cursor-ns-resize z-50 select-none"
      />
      <div
        onMouseDown={handleResizeMouseDown("South")}
        className="absolute bottom-0 left-3 right-3 h-2.5 cursor-ns-resize z-50 select-none"
      />
      <div
        onMouseDown={handleResizeMouseDown("West")}
        className="absolute left-0 top-3 bottom-3 w-2.5 cursor-ew-resize z-50 select-none"
      />
      <div
        onMouseDown={handleResizeMouseDown("East")}
        className="absolute right-0 top-3 bottom-3 w-2.5 cursor-ew-resize z-50 select-none"
      />
      <div
        onMouseDown={handleResizeMouseDown("NorthWest")}
        className="absolute top-0 left-0 w-3.5 h-3.5 cursor-nwse-resize z-50 select-none"
      />
      <div
        onMouseDown={handleResizeMouseDown("NorthEast")}
        className="absolute top-0 right-0 w-3.5 h-3.5 cursor-nesw-resize z-50 select-none"
      />
      <div
        onMouseDown={handleResizeMouseDown("SouthWest")}
        className="absolute bottom-0 left-0 w-3.5 h-3.5 cursor-nesw-resize z-50 select-none"
      />
      <div
        onMouseDown={handleResizeMouseDown("SouthEast")}
        className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize z-50 select-none"
      />

      <article
        data-od-id={`note-card-${noteId}`}
        onClick={handleEnterEdit}
        className="relative flex w-full h-full flex-col overflow-hidden text-[#e5e2e1] select-none border-[1.5px] ring-1 ring-inset ring-white/10 rounded-[10px] bg-[#141313] transition-[border-color,box-shadow] duration-200 ease-out box-border shrink-0 min-w-0 min-h-0"
        style={getNeonStyle(activeColor.accentHex || "#06b6d4", isEditing)}
      >
        {/* 1. Barra Superior (Bandeja): Desliza sutilmente do topo no modo edição */}
        <div
          className={`shrink-0 overflow-hidden transition-all duration-200 ease-out flex flex-col justify-end ${
            isEditing
              ? "h-8 opacity-100 translate-y-0 border-b border-white/10 bg-white/[0.03]"
              : "h-2.5 opacity-0 -translate-y-2 border-b-transparent cursor-move"
          }`}
          {...(!isEditing ? { "data-tauri-drag-region": true, onMouseDown: handleStartDrag } : {})}
        >
          <div className="h-8 flex items-center justify-between px-3 shrink-0">
            {/* Lado Esquerdo: Área de Arrasto com Ícone Funcional */}
            <div
              data-tauri-drag-region
              onMouseDown={handleStartDrag}
              className="flex items-center gap-1.5 min-w-0 flex-1 h-full cursor-move"
            >
              <div
                className="p-1 -ml-1 rounded hover:bg-white/10 cursor-move flex items-center"
                title="Arrastar nota"
              >
                <DotsSixVertical className="text-white/40 text-[15px] select-none pointer-events-none" />
              </div>
              {isSaving && (
                <span className="text-[9px] text-white/35 ml-1 animate-pulse pointer-events-none">
                  salvando...
                </span>
              )}
            </div>

            {/* Lado Direito: Seletor de Cores Zen + Botão Fechar */}
            <div
              className="no-drag relative flex items-center gap-1 shrink-0 ml-2 cursor-default"
              data-tauri-drag-region="false"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="relative" ref={paletteRef}>
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsPaletteOpen((prev) => !prev);
                  }}
                  className="icon-btn-sm cursor-pointer"
                  title="Mudar cor"
                  aria-label="Mudar cor"
                >
                  <span
                    className="w-3 h-3 rounded-full border border-white/30 pointer-events-none"
                    style={{ background: activeColor.accentHex }}
                  />
                </button>

                {isPaletteOpen && (
                  <div
                    className="no-drag absolute top-7 right-0 bg-[#201f1f] border border-white/15 rounded-xl p-2.5 shadow-2xl z-30"
                    data-tauri-drag-region="false"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1.5">
                      {NOTE_COLORS.map((c) => {
                        const isSelected = activeColor.id === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleColorSelect(c.id);
                            }}
                            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center cursor-pointer transition-transform hover:scale-105 ${
                              isSelected ? "border-white" : "border-transparent"
                            }`}
                            style={{ background: c.accentHex }}
                            title={c.name}
                            aria-label={`Cor ${c.name}`}
                          >
                            {isSelected && (
                              <Check className="text-[10px] text-zinc-950 font-bold pointer-events-none" weight="bold" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Botão Fechar (X): Presente apenas quando o usuário clica na nota */}
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClose();
                }}
                aria-label="Fechar nota"
                title="Fechar nota"
                className="icon-btn-sm hover:bg-red-500/20 hover:text-red-400 cursor-pointer"
              >
                <X className="text-[13px] pointer-events-none" />
              </button>
            </div>
          </div>
        </div>

        {/* 2. Área Central de Conteúdo */}
        <div className="flex-1 min-h-0 flex flex-col pl-3.5 pr-1.5 py-2 overflow-hidden">
          {isEditing ? (
            /* Modo Edição: Textarea Markdown Full-Height (Sem título colorido) */
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onScroll={(e) => {
                lastScrollTopRef.current = e.currentTarget.scrollTop;
              }}
              spellCheck={false}
              placeholder="Escreva em markdown..."
              className="flex-1 w-full h-full bg-transparent font-sans text-[12.5px] leading-[1.65] text-white/70 placeholder:text-white/25 outline-none rounded focus:bg-white/[0.02] resize-none border-none focus:ring-0 p-0 overflow-y-auto note-scrollbar"
              autoFocus
            />
          ) : (
            /* Modo Preview: Conteúdo puro clicável (Entra em modo edição ao clicar no texto) */
            <div
              ref={previewRef}
              onClick={handleEnterEdit}
              onMouseDown={handleEnterEdit}
              onScroll={(e) => {
                lastScrollTopRef.current = e.currentTarget.scrollTop;
              }}
              className="flex-1 min-h-0 overflow-y-auto note-scrollbar pr-1 cursor-text"
            >
              {content.trim() ? (
                <div className="text-[12.5px] leading-[1.65] text-white/70 break-words pointer-events-none">
                  <MarkdownPreview source={content} />
                </div>
              ) : (
                <div className="text-[12.5px] leading-[1.65] text-white/25 italic select-none">
                  — clique para escrever —
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Barra Inferior de Ferramentas (Bandeja): Desliza sutilmente do rodapé */}
        <div
          className={`shrink-0 overflow-hidden transition-all duration-200 ease-out flex flex-col justify-start ${
            isEditing
              ? "h-9 opacity-100 translate-y-0 border-t border-white/10 bg-black/20"
              : "h-0 opacity-0 translate-y-full border-t-0 pointer-events-none"
          }`}
        >
          <div className="h-9 flex items-center justify-between px-2.5 shrink-0">
            {/* Lado Esquerdo: Formatação Markdown + Upload Imagem */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => insertMdSnippet("bold")}
                className="icon-btn-sm"
                title="Negrito"
              >
                <TextB className="text-[14px]" weight="bold" />
              </button>
              <button
                type="button"
                onClick={() => insertMdSnippet("underline")}
                className="icon-btn-sm"
                title="Sublinhado"
              >
                <TextUnderline className="text-[14px]" />
              </button>
              <button
                type="button"
                onClick={() => insertMdSnippet("strike")}
                className="icon-btn-sm"
                title="Tachado"
              >
                <TextStrikethrough className="text-[14px]" />
              </button>
              <button
                type="button"
                onClick={() => insertMdSnippet("list")}
                className="icon-btn-sm"
                title="Bullets"
              >
                <ListBullets className="text-[14px]" />
              </button>
              <button
                type="button"
                onClick={triggerImageUpload}
                className="icon-btn-sm"
                title="Upload de imagem"
              >
                <ImageSquare className="text-[14px]" />
              </button>
            </div>

            {/* Lado Direito: Arquivar */}
            <div className="flex items-center">
              <button
                type="button"
                onClick={handleArchive}
                className="icon-btn-sm hover:bg-red-500/20 hover:text-red-400"
                title="Arquivar"
              >
                <Archive className="text-[15px]" />
              </button>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
};
