import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  TextB,
  TextItalic,
  TextStrikethrough,
  ListBullets,
  ListNumbers,
  CheckSquare,
  Quotes,
  Link,
  Image,
  PencilSimple,
  Eye,
  DotsThree,
} from "@phosphor-icons/react";
import { MarkdownPreview } from "./MarkdownPreview";
import { formatRelative } from "../lib/utils";
import { Note } from "../services/db";

type Props = {
  note: Note | null;
  onSaveNote: (updatedNote: Note) => Promise<void> | void;
  onSaveStateChange?: (state: "saved" | "saving" | "unsaved") => void;
  onTogglePin?: (note: Note) => void;
  onOpenSticky?: (note: Note) => void;
  autoSaveInterval?: number;
};

export const MarkdownEditor: React.FC<Props> = ({
  note,
  onSaveNote,
  onSaveStateChange,
  autoSaveInterval = 500,
}) => {
  const [tab, setTab] = useState<"edit" | "view">("edit");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [toolbarWidth, setToolbarWidth] = useState<number>(600);

  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMountRef = useRef<boolean>(true);
  const currentNoteIdRef = useRef<string | null>(null);

  // Monitorar largura da Toolbar com ResizeObserver para responsividade real
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setToolbarWidth(entry.contentRect.width);
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Sincronizar estado local com a nota ativa
  useEffect(() => {
    if (note) {
      currentNoteIdRef.current = note.id;
      setTitle(note.title || "");
      setContent(note.content || "");
      isInitialMountRef.current = true;
      if (onSaveStateChange) onSaveStateChange("saved");
    } else {
      currentNoteIdRef.current = null;
      setTitle("");
      setContent("");
      if (onSaveStateChange) onSaveStateChange("saved");
    }
  }, [note?.id, note?.updated_at]);

  // Fechar dropdown de mais ferramentas ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(e.target as Node)
      ) {
        setIsMoreMenuOpen(false);
      }
    };
    if (isMoreMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMoreMenuOpen]);

  // Função de salvamento
  const triggerSave = useCallback(
    async (updatedTitle: string, updatedContent: string) => {
      if (!note || !note.id) return;
      try {
        if (onSaveStateChange) onSaveStateChange("saving");
        const now = new Date().toISOString();
        const updated: Note = {
          ...note,
          title: updatedTitle,
          content: updatedContent,
          updated_at: now,
        };
        await onSaveNote(updated);
        if (onSaveStateChange) onSaveStateChange("saved");
      } catch (err) {
        console.error("Erro ao salvar nota:", err);
        if (onSaveStateChange) onSaveStateChange("unsaved");
      }
    },
    [note, onSaveNote, onSaveStateChange]
  );

  // Auto-save com debounce
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    if (!note) return;

    const hasChanged = title !== note.title || content !== note.content;

    if (hasChanged) {
      if (onSaveStateChange) onSaveStateChange("unsaved");

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        triggerSave(title, content);
      }, autoSaveInterval);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [title, content, note, autoSaveInterval, triggerSave, onSaveStateChange]);

  const handleBlur = () => {
    if (!note) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (title !== note.title || content !== note.content) {
      triggerSave(title, content);
    }
  };

  // Funções de formatação Markdown da Toolbar
  const insertMarkdown = (prefix: string, suffix: string = "", placeholder: string = "") => {
    if (tab !== "edit") setTab("edit");
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const replacement = selectedText ? `${prefix}${selectedText}${suffix}` : `${prefix}${placeholder}${suffix}`;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = selectedText
        ? start + replacement.length
        : start + prefix.length + placeholder.length;
      textarea.setSelectionRange(start + prefix.length, newCursorPos);
    }, 10);
  };

  const insertLinePrefix = (linePrefix: string) => {
    if (tab !== "edit") setTab("edit");
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const beforeCursor = content.substring(0, start);
    const lastNewline = beforeCursor.lastIndexOf("\n");
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;

    const newContent =
      content.substring(0, lineStart) + linePrefix + content.substring(lineStart);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + linePrefix.length, start + linePrefix.length);
    }, 10);
  };

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-app-muted bg-app-editor select-none">
        Selecione ou crie uma nota
      </div>
    );
  }

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;

  // Determinar níveis de visibilidade com base na largura real do editor
  // Largura total: > 580px | Média: 420px - 580px | Compacta: < 420px
  const isWide = toolbarWidth >= 580;
  const isMedium = toolbarWidth >= 420;

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-app-editor">
      {/* Barra de Ferramentas de Formatação Markdown Responsiva */}
      <div
        ref={toolbarRef}
        className="relative h-10 border-b border-app-border flex items-center justify-between px-3 bg-app-dark shrink-0 select-none z-30"
      >
        {/* Bloco de Ferramentas com Responsividade Dinâmica baseada em toolbarWidth */}
        <div className="flex items-center gap-1 min-w-0 flex-1 overflow-visible">
          {/* Títulos Rápidos */}
          <div className="flex items-center gap-0.5 text-app-icon shrink-0">
            <button
              onClick={() => insertLinePrefix("# ")}
              title="Título H1"
              className="hover:text-app-text transition-colors font-bold text-xs px-1.5 py-1 rounded hover:bg-white/5"
            >
              H1
            </button>
            <button
              onClick={() => insertLinePrefix("## ")}
              title="Título H2"
              className="hover:text-app-text transition-colors font-bold text-xs px-1.5 py-1 rounded hover:bg-white/5"
            >
              H2
            </button>
            {isMedium && (
              <button
                onClick={() => insertLinePrefix("### ")}
                title="Título H3"
                className="hover:text-app-text transition-colors font-bold text-xs px-1.5 py-1 rounded hover:bg-white/5"
              >
                H3
              </button>
            )}
          </div>

          <div className="w-px h-3.5 bg-app-border shrink-0 mx-0.5"></div>

          {/* Formatação Inline */}
          <div className="flex items-center gap-0.5 text-app-icon shrink-0">
            <button
              onClick={() => insertMarkdown("**", "**", "texto")}
              title="Negrito (Ctrl+B)"
              className="hover:text-app-text transition-colors p-1.5 rounded hover:bg-white/5"
            >
              <TextB className="text-base" />
            </button>
            <button
              onClick={() => insertMarkdown("*", "*", "texto")}
              title="Itálico (Ctrl+I)"
              className="hover:text-app-text transition-colors p-1.5 rounded hover:bg-white/5"
            >
              <TextItalic className="text-base" />
            </button>
            {isWide && (
              <button
                onClick={() => insertMarkdown("~~", "~~", "texto")}
                title="Tachado"
                className="hover:text-app-text transition-colors p-1.5 rounded hover:bg-white/5"
              >
                <TextStrikethrough className="text-base" />
              </button>
            )}
          </div>

          <div className="w-px h-3.5 bg-app-border shrink-0 mx-0.5"></div>

          {/* Listas e Checkboxes */}
          <div className="flex items-center gap-0.5 text-app-icon shrink-0">
            <button
              onClick={() => insertLinePrefix("- ")}
              title="Lista com marcadores"
              className="hover:text-app-text transition-colors p-1.5 rounded hover:bg-white/5"
            >
              <ListBullets className="text-base" />
            </button>
            {isWide && (
              <button
                onClick={() => insertLinePrefix("1. ")}
                title="Lista numerada"
                className="hover:text-app-text transition-colors p-1.5 rounded hover:bg-white/5"
              >
                <ListNumbers className="text-base" />
              </button>
            )}
            <button
              onClick={() => insertLinePrefix("- [ ] ")}
              title="Lista de tarefas (Checkbox)"
              className="hover:text-app-text transition-colors p-1.5 rounded hover:bg-white/5"
            >
              <CheckSquare className="text-base" />
            </button>
          </div>

          {/* Inserções de Link, Citação e Imagem em telas largas */}
          {isWide && (
            <div className="flex items-center gap-0.5 text-app-icon shrink-0">
              <div className="w-px h-3.5 bg-app-border shrink-0 mx-0.5"></div>
              <button
                onClick={() => insertLinePrefix("> ")}
                title="Citação"
                className="hover:text-app-text transition-colors p-1.5 rounded hover:bg-white/5"
              >
                <Quotes className="text-base" />
              </button>
              <button
                onClick={() => insertMarkdown("[", "](url)", "link")}
                title="Inserir Link"
                className="hover:text-app-text transition-colors p-1.5 rounded hover:bg-white/5"
              >
                <Link className="text-base" />
              </button>
              <button
                onClick={() => insertMarkdown("![alt](", ")", "https://")}
                title="Inserir Imagem"
                className="hover:text-app-text transition-colors p-1.5 rounded hover:bg-white/5"
              >
                <Image className="text-base" />
              </button>
            </div>
          )}

          {/* Menu Dropdown de Elipse com Ferramentas Ocultadas */}
          {(!isWide || !isMedium) && (
            <div className="relative shrink-0" ref={moreMenuRef}>
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMoreMenuOpen((prev) => !prev);
                }}
                title="Mais opções de formatação"
                className={`p-1.5 rounded transition-colors text-app-icon cursor-pointer ${
                  isMoreMenuOpen
                    ? "bg-white/10 text-white"
                    : "hover:bg-white/5 hover:text-app-text"
                }`}
              >
                <DotsThree className="text-base font-bold" weight="bold" />
              </button>

              {isMoreMenuOpen && (
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  className="absolute left-0 top-full mt-1.5 w-48 rounded-lg border border-app-border bg-zinc-900/98 backdrop-blur-md p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 text-app-text text-xs space-y-0.5"
                >
                  {!isMedium && (
                    <button
                      onClick={() => {
                        insertLinePrefix("### ");
                        setIsMoreMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2.5 px-2 py-1.5 rounded hover:bg-white/10 hover:text-white transition-colors text-left"
                    >
                      <span className="font-bold text-xs w-4 text-center">H3</span>
                      <span>Subtítulo H3</span>
                    </button>
                  )}

                  {!isWide && (
                    <>
                      <button
                        onClick={() => {
                          insertMarkdown("~~", "~~", "texto");
                          setIsMoreMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 px-2 py-1.5 rounded hover:bg-white/10 hover:text-white transition-colors text-left"
                      >
                        <TextStrikethrough className="text-sm text-app-muted w-4" />
                        <span>Tachado (Riscado)</span>
                      </button>

                      <button
                        onClick={() => {
                          insertLinePrefix("1. ");
                          setIsMoreMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 px-2 py-1.5 rounded hover:bg-white/10 hover:text-white transition-colors text-left"
                      >
                        <ListNumbers className="text-sm text-app-muted w-4" />
                        <span>Lista numerada</span>
                      </button>

                      <button
                        onClick={() => {
                          insertLinePrefix("> ");
                          setIsMoreMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 px-2 py-1.5 rounded hover:bg-white/10 hover:text-white transition-colors text-left"
                      >
                        <Quotes className="text-sm text-app-muted w-4" />
                        <span>Citação</span>
                      </button>

                      <button
                        onClick={() => {
                          insertMarkdown("[", "](url)", "link");
                          setIsMoreMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 px-2 py-1.5 rounded hover:bg-white/10 hover:text-white transition-colors text-left"
                      >
                        <Link className="text-sm text-app-muted w-4" />
                        <span>Inserir Link</span>
                      </button>

                      <button
                        onClick={() => {
                          insertMarkdown("![alt](", ")", "https://");
                          setIsMoreMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2.5 px-2 py-1.5 rounded hover:bg-white/10 hover:text-white transition-colors text-left"
                      >
                        <Image className="text-sm text-app-muted w-4" />
                        <span>Inserir Imagem</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Seletor Segmentado Edit / View no canto direito */}
        <div className="flex items-center gap-1 bg-zinc-800/50 p-0.5 rounded-md border border-app-border shrink-0 ml-2">
          <button
            onClick={() => setTab("edit")}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold transition-colors ${
              tab === "edit"
                ? "bg-zinc-700 text-white shadow-xs"
                : "text-app-muted hover:text-app-text"
            }`}
          >
            <PencilSimple className="text-xs" />
            <span>Edit</span>
          </button>
          <button
            onClick={() => setTab("view")}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold transition-colors ${
              tab === "view"
                ? "bg-zinc-700 text-white shadow-xs"
                : "text-app-muted hover:text-app-text"
            }`}
          >
            <Eye className="text-xs" />
            <span>View</span>
          </button>
        </div>
      </div>

      {/* Área Principal de Edição / Visualização Fluida e Sem Calha Estática */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-app-editor">
        {tab === "edit" ? (
          <div className="flex-1 p-4 md:p-6 flex flex-col min-h-0 overflow-hidden">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={handleBlur}
              spellCheck={false}
              placeholder="Comece a escrever em Markdown..."
              className="editor-textarea flex-1 w-full h-full bg-transparent border-none resize-none text-app-text font-mono text-[13.5px] leading-relaxed placeholder:text-zinc-600 p-0 focus:ring-0 focus:outline-none overflow-y-auto"
            />
          </div>
        ) : (
          <div className="flex-1 p-4 md:p-6 w-full h-full overflow-y-auto text-app-text">
            <MarkdownPreview source={content} />
          </div>
        )}

        {/* Status Bar Inferior (h-10 para casar com o rodapé da Sidebar) */}
        <footer className="h-10 border-t border-app-border flex items-center justify-between px-4 text-xs text-app-muted shrink-0 bg-app-dark select-none">
          <div>
            {words} palavra{words === 1 ? "" : "s"} · Markdown
          </div>
          <div>
            Editado {formatRelative(note.updated_at)}
          </div>
        </footer>
      </main>
    </div>
  );
};
