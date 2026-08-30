import React, { useState, useEffect, useRef, useCallback } from "react";
import { Eye, Pencil } from "lucide-react";
import { MarkdownPreview } from "./MarkdownPreview";
import { formatRelative } from "../lib/utils";
import { Note } from "../services/db";

type Props = {
  note: Note | null;
  onSaveNote: (updatedNote: Note) => Promise<void> | void;
  onSaveStateChange?: (state: "saved" | "saving" | "unsaved") => void;
  autoSaveInterval?: number;
};

export const MarkdownEditor: React.FC<Props> = ({
  note,
  onSaveNote,
  onSaveStateChange,
  autoSaveInterval = 500,
}) => {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMountRef = useRef<boolean>(true);
  const currentNoteIdRef = useRef<string | null>(null);

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
  }, [note?.id]);

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

  if (!note) {
    return (
      <div className="grid flex-1 place-items-center text-sm text-muted-foreground select-none">
        Selecione ou crie uma nota
      </div>
    );
  }

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Barra de Título da Nota com Toggle de Modo */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleBlur}
          placeholder="Título da nota"
          className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-foreground outline-none placeholder:text-muted-foreground"
        />
        <div className="flex shrink-0 items-center rounded-md border border-border p-0.5">
          <button
            onClick={() => setTab("edit")}
            className={`flex items-center gap-1 rounded-[5px] px-2 py-1 text-[11px] font-medium transition-colors ${
              tab === "edit"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Pencil className="size-3" />
            <span>Editar</span>
          </button>
          <button
            onClick={() => setTab("preview")}
            className={`flex items-center gap-1 rounded-[5px] px-2 py-1 text-[11px] font-medium transition-colors ${
              tab === "preview"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="size-3" />
            <span>Preview</span>
          </button>
        </div>
      </div>

      {/* Área de Conteúdo da Nota */}
      <div className="flex-1 overflow-y-auto">
        {tab === "edit" ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleBlur}
            spellCheck={false}
            placeholder="Comece a escrever em Markdown…"
            className="h-full w-full resize-none bg-transparent p-4 font-mono text-[13px] leading-relaxed text-foreground/90 outline-none placeholder:text-muted-foreground"
          />
        ) : (
          <div className="p-4">
            <MarkdownPreview source={content} />
          </div>
        )}
      </div>

      {/* Rodapé com Contador de Palavras e Data */}
      <footer className="flex items-center justify-between border-t border-border px-4 py-1.5 text-[10.5px] text-muted-foreground">
        <span>{words} palavras · Markdown</span>
        <span>Editado {formatRelative(note.updated_at)}</span>
      </footer>
    </div>
  );
};
