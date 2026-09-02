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
} from "@phosphor-icons/react";
import { dbService, Note } from "../services/db";
import { NOTE_COLORS, getNoteColor } from "../lib/colors";
import { formatRelative } from "../lib/utils";

interface StickyNoteViewProps {
  noteId: string;
}

export const StickyNoteView: React.FC<StickyNoteViewProps> = ({ noteId }) => {
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("Sem título");
  const [category, setCategory] = useState("Geral");
  const [content, setContent] = useState("");
  const [color, setColor] = useState<string>("cyan");
  const [isSaving, setIsSaving] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMountRef = useRef<boolean>(true);
  const geometryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isClosingRef = useRef<boolean>(false);
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const categoryRef = useRef<HTMLSpanElement | null>(null);
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
            if (titleRef.current && document.activeElement !== titleRef.current) {
              titleRef.current.innerText = incoming.title || "Sem título";
            }
            if (categoryRef.current && document.activeElement !== categoryRef.current) {
              categoryRef.current.innerText = incoming.tags && incoming.tags.length > 0 ? incoming.tags[0] : "Geral";
            }
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
    async (updatedTitle: string, updatedContent: string, updatedColor?: string, updatedCategory?: string) => {
      if (!noteId) return;
      try {
        setIsSaving(true);
        const now = new Date().toISOString();
        const finalColor = updatedColor !== undefined ? updatedColor : (note?.color || color || "cyan");
        const finalCategory = updatedCategory !== undefined ? updatedCategory : category;
        const updated: Note = {
          id: noteId,
          title: updatedTitle.trim() || "Sem título",
          content: updatedContent,
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
      } catch (err) {
        console.error("Erro ao salvar nota adesiva:", err);
      } finally {
        setIsSaving(false);
      }
    },
    [noteId, note, color, category]
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

  const handleTitleBlur = (e: React.FocusEvent<HTMLHeadingElement>) => {
    const raw = e.currentTarget.innerText.trim();
    const newTitle = raw || "Sem título";
    setTitle(newTitle);
    if (newTitle !== note?.title) {
      handleSave(newTitle, content);
    }
  };

  const handleCategoryBlur = (e: React.FocusEvent<HTMLSpanElement>) => {
    const raw = e.currentTarget.innerText.trim();
    const newCat = raw || "Geral";
    setCategory(newCat);
    handleSave(title, content, color, newCat);
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

  const activeColor = getNoteColor(color);
  const timeLabel = note?.updated_at ? formatRelative(note.updated_at) : "agora";

  return (
    <article
      data-od-id={`note-card-focused-${noteId}`}
      className={`glass-panel-focused relative flex h-screen w-screen flex-col overflow-hidden text-[#e5e2e1] select-none border ${activeColor.borderActive} ${activeColor.shadowActive} ring-1 ring-white/10`}
    >
      {/* 1. Barra Superior de Metadados - Exatamente ZenNotes: h-8, px-3, border-b border-white/10, bg-white/[0.03] */}
      <div
        data-tauri-drag-region
        className="h-8 flex items-center justify-between px-3 border-b border-white/10 bg-white/[0.03] shrink-0 cursor-move"
      >
        <div data-tauri-drag-region className="flex items-center gap-1.5 min-w-0 flex-1 cursor-move">
          <span
            ref={categoryRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Categoria"
            onBlur={handleCategoryBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            className="text-[10px] font-bold tracking-widest uppercase text-white/45 hover:text-white/70 hover:bg-white/5 px-1.5 py-0.5 rounded outline-none truncate max-w-[110px] cursor-text"
          >
            {category}
          </span>
          <span className="text-white/10 select-none">·</span>
          <span className="text-[10px] text-white/25 font-mono select-none">
            {timeLabel}
          </span>
          {isSaving && (
            <span className="text-[9px] text-white/30 ml-1 animate-pulse pointer-events-none">
              salvando...
            </span>
          )}
        </div>

        {/* Lado Direito: Seletor de Cores Zen + Botão Fechar discreto */}
        <div className="relative flex items-center gap-1 shrink-0 ml-2">
          {/* Seletor de Cores ZenNotes */}
          <div className="relative" ref={paletteRef}>
            <button
              onClick={() => setIsPaletteOpen((prev) => !prev)}
              className="icon-btn-sm"
              title="Mudar cor"
            >
              <span
                className="w-3 h-3 rounded-full border border-white/30"
                style={{ background: activeColor.accentHex }}
              />
            </button>

            {isPaletteOpen && (
              <div className="no-drag absolute top-7 right-0 bg-[#201f1f] border border-white/15 rounded-xl p-2.5 shadow-2xl z-20">
                <div className="flex items-center gap-1.5">
                  {NOTE_COLORS.map((c) => {
                    const isSelected = (color || "cyan") === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleColorSelect(c.id)}
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center cursor-pointer ${
                          isSelected ? "border-white" : "border-transparent"
                        }`}
                        style={{ background: c.accentHex }}
                        title={c.name}
                      >
                        {isSelected && (
                          <Check className="text-[10px] text-zinc-950 font-bold" weight="bold" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Botão Fechar Discreto */}
          <button
            onClick={handleClose}
            aria-label="Fechar nota"
            title="Fechar nota"
            className="icon-btn-sm hover:bg-red-500/20 hover:text-red-400"
          >
            <X className="text-[13px]" />
          </button>
        </div>
      </div>

      {/* 2. Área de Conteúdo Central - Exatamente ZenNotes: px-3.5 py-3 space-y-2 */}
      <div className="flex-1 min-h-0 overflow-y-auto note-scrollbar px-3.5 py-3 space-y-2">
        {/* Título H2 contenteditable Estilo ZenNotes */}
        <h2
          ref={titleRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Título da nota..."
          onBlur={handleTitleBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          className={`text-[14px] font-semibold tracking-tight ${activeColor.textAccent} outline-none rounded px-1 -mx-1 focus:bg-white/[0.04] leading-tight break-words`}
        >
          {title}
        </h2>

        {/* Corpo Markdown */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
          placeholder="Escreva em markdown..."
          className="w-full bg-transparent font-sans text-[12.5px] leading-[1.65] text-white/65 outline-none rounded px-1 -mx-1 focus:bg-white/[0.04] min-h-[88px] resize-none border-none focus:ring-0 p-0"
          rows={7}
        />
      </div>

      {/* 3. Barra Inferior de Ferramentas - Exatamente ZenNotes: h-9, px-2.5, border-t border-white/10, bg-black/20 */}
      <div className="h-9 flex items-center justify-between px-2.5 border-t border-white/10 bg-black/20 shrink-0">
        {/* Lado Esquerdo: Formatação Markdown + Upload Imagem */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => insertMdSnippet("bold")}
            className="icon-btn-sm"
            title="Negrito"
          >
            <TextB className="text-[14px]" weight="bold" />
          </button>
          <button
            onClick={() => insertMdSnippet("underline")}
            className="icon-btn-sm"
            title="Sublinhado"
          >
            <TextUnderline className="text-[14px]" />
          </button>
          <button
            onClick={() => insertMdSnippet("strike")}
            className="icon-btn-sm"
            title="Tachado"
          >
            <TextStrikethrough className="text-[14px]" />
          </button>
          <button
            onClick={() => insertMdSnippet("list")}
            className="icon-btn-sm"
            title="Bullets"
          >
            <ListBullets className="text-[14px]" />
          </button>
          <button
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
            onClick={handleArchive}
            className="icon-btn-sm"
            title="Arquivar"
          >
            <Archive className="text-[15px]" />
          </button>
        </div>
      </div>
    </article>
  );
};
