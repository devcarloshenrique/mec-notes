import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import {
  Eye,
  Edit3,
  Check,
  Clock,
  Type,
  Tag as TagIcon,
  Plus,
  X,
  FileDown,
  Copy,
} from "lucide-react";
import { Note } from "../services/db";

interface EditorProps {
  note: Note | null;
  onSaveNote: (updatedNote: Note) => Promise<void> | void;
  autoSaveInterval?: number;
}

export const Editor: React.FC<EditorProps> = ({
  note,
  onSaveNote,
  autoSaveInterval = 500,
}) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [isTagInputVisible, setIsTagInputVisible] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview" | "split">("edit");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved"
  );
  const [copied, setCopied] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMountRef = useRef<boolean>(true);
  const currentNoteIdRef = useRef<string | null>(null);

  // Sincronizar estado local com a nota ativa
  useEffect(() => {
    if (note) {
      // Salvar nota anterior pendente se houver antes de carregar nova
      if (currentNoteIdRef.current && currentNoteIdRef.current !== note.id && saveStatus === "unsaved") {
        // Disparar salvamento síncrono imediato
      }

      currentNoteIdRef.current = note.id;
      setTitle(note.title || "");
      setContent(note.content || "");
      setTags(note.tags || []);
      setSaveStatus("saved");
      isInitialMountRef.current = true;
    } else {
      currentNoteIdRef.current = null;
      setTitle("");
      setContent("");
      setTags([]);
      setSaveStatus("saved");
    }
  }, [note?.id]);

  // Função de salvamento
  const triggerSave = useCallback(
    async (noteToSave: Note) => {
      if (!noteToSave.id) return;
      try {
        setSaveStatus("saving");
        const now = new Date().toISOString();
        const updated = {
          ...noteToSave,
          updated_at: now,
        };
        await onSaveNote(updated);
        setSaveStatus("saved");
      } catch (err) {
        console.error("Erro ao salvar nota:", err);
        setSaveStatus("unsaved");
      }
    },
    [onSaveNote]
  );

  // Auto-save com debounce ao modificar título, conteúdo ou tags
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    if (!note) return;

    // Verificar se houve alteração real
    const hasChanged =
      title !== note.title ||
      content !== note.content ||
      JSON.stringify(tags) !== JSON.stringify(note.tags);

    if (hasChanged) {
      setSaveStatus("unsaved");

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        triggerSave({
          ...note,
          title,
          content,
          tags,
        });
      }, autoSaveInterval);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [title, content, tags, note, autoSaveInterval, triggerSave]);

  // Salvar no onBlur imediato
  const handleBlur = () => {
    if (!note || saveStatus === "saved") return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    triggerSave({
      ...note,
      title,
      content,
      tags,
    });
  };

  // Gerenciamento de Tags
  const handleAddTag = () => {
    const trimmed = newTagInput.trim().replace(/^#/, "");
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setNewTagInput("");
    setIsTagInputVisible(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  // Estatísticas do texto
  const charCount = content.length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const lineCount = content ? content.split("\n").length : 0;

  const handleCopyContent = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (!note) return;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.trim() || "nota"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!note) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 text-slate-500 p-8 select-none">
        <Edit3 className="w-12 h-12 mb-3 text-slate-700 stroke-[1.5]" />
        <h3 className="text-sm font-medium text-slate-400 mb-1">
          Nenhuma nota selecionada
        </h3>
        <p className="text-xs text-slate-500 max-w-xs text-center">
          Selecione uma nota na barra lateral ou crie uma nova para começar a editar.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden">
      {/* Barra de Ferramentas Superior */}
      <div className="h-11 border-b border-slate-800 px-4 flex items-center justify-between gap-2 shrink-0 bg-slate-900/90 backdrop-blur select-none">
        {/* Modos de visualização */}
        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
          <button
            onClick={() => setMode("edit")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
              mode === "edit"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Modo Edição"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Editor</span>
          </button>
          <button
            onClick={() => setMode("preview")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
              mode === "preview"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Modo Pré-visualização"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview</span>
          </button>
          <button
            onClick={() => setMode("split")}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition ${
              mode === "split"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Lado a Lado"
          >
            <span>Dividido</span>
          </button>
        </div>

        {/* Status de Salvamento e Ações Rápidas */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-800/60 border border-slate-800">
            {saveStatus === "saving" && (
              <>
                <Clock className="w-3 h-3 text-amber-400 animate-spin" />
                <span className="text-amber-400">Salvando...</span>
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Salvo</span>
              </>
            )}
            {saveStatus === "unsaved" && (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-slate-400">Não salvo</span>
              </>
            )}
          </div>

          <button
            onClick={handleCopyContent}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
            title={copied ? "Copiado!" : "Copiar texto"}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleDownloadMarkdown}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
            title="Exportar .md"
          >
            <FileDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Cabeçalho do Documento (Título e Tags) */}
      <div className="px-6 pt-4 pb-2 border-b border-slate-800/50 space-y-2 shrink-0">
        <input
          type="text"
          placeholder="Título da nota..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleBlur}
          className="w-full bg-transparent text-lg font-bold text-slate-100 placeholder-slate-600 focus:outline-none tracking-tight"
        />

        {/* Gerenciamento de Tags */}
        <div className="flex items-center flex-wrap gap-1.5">
          <TagIcon className="w-3.5 h-3.5 text-slate-500 mr-0.5" />
          {tags.map((tag) => (
            <span
              key={tag}
              className="group inline-flex items-center gap-1 bg-slate-800 text-indigo-300 text-xs px-2 py-0.5 rounded-full border border-slate-700/60"
            >
              <span>#{tag}</span>
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-red-400 opacity-60 group-hover:opacity-100 transition"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {isTagInputVisible ? (
            <div className="inline-flex items-center gap-1">
              <input
                type="text"
                autoFocus
                placeholder="tag..."
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddTag();
                  if (e.key === "Escape") setIsTagInputVisible(false);
                }}
                onBlur={handleAddTag}
                className="bg-slate-800 text-xs text-slate-200 px-2 py-0.5 rounded-full border border-indigo-500 focus:outline-none w-20"
              />
            </div>
          ) : (
            <button
              onClick={() => setIsTagInputVisible(true)}
              className="inline-flex items-center gap-0.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/40 hover:bg-slate-800 px-2 py-0.5 rounded-full border border-dashed border-slate-700 transition"
            >
              <Plus className="w-3 h-3" />
              <span>tag</span>
            </button>
          )}
        </div>
      </div>

      {/* Área Principal de Conteúdo */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor de Texto */}
        {(mode === "edit" || mode === "split") && (
          <div
            className={`flex-1 flex flex-col h-full ${
              mode === "split" ? "border-r border-slate-800" : ""
            }`}
          >
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={handleBlur}
              placeholder="Comece a digitar em Markdown... (# Título, - Lista, **negrito**, `código`)"
              className="w-full h-full p-6 bg-slate-900 text-slate-200 placeholder-slate-600 resize-none focus:outline-none font-mono text-sm leading-relaxed scrollbar-thin"
              spellCheck={false}
            />
          </div>
        )}

        {/* Pré-visualização Markdown */}
        {(mode === "preview" || mode === "split") && (
          <div className="flex-1 h-full p-6 overflow-y-auto bg-slate-950/40 text-slate-200 prose prose-invert prose-sm max-w-none scrollbar-thin">
            {content.trim() ? (
              <ReactMarkdown
                components={{
                  h1: ({ ...props }) => (
                    <h1 className="text-xl font-bold border-b border-slate-800 pb-1 mb-3 text-slate-100" {...props} />
                  ),
                  h2: ({ ...props }) => (
                    <h2 className="text-lg font-bold border-b border-slate-800/60 pb-1 mb-2 text-slate-100" {...props} />
                  ),
                  h3: ({ ...props }) => (
                    <h3 className="text-base font-semibold mb-2 text-slate-200" {...props} />
                  ),
                  p: ({ ...props }) => (
                    <p className="mb-3 leading-relaxed text-slate-300" {...props} />
                  ),
                  ul: ({ ...props }) => (
                    <ul className="list-disc pl-5 mb-3 space-y-1 text-slate-300" {...props} />
                  ),
                  ol: ({ ...props }) => (
                    <ol className="list-decimal pl-5 mb-3 space-y-1 text-slate-300" {...props} />
                  ),
                  blockquote: ({ ...props }) => (
                    <blockquote className="border-l-2 border-indigo-500 pl-3 my-2 text-slate-400 italic" {...props} />
                  ),
                  code: ({ className, children, ...props }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="bg-slate-800 text-indigo-300 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                        {children}
                      </code>
                    ) : (
                      <pre className="bg-slate-950 border border-slate-800 p-3 rounded-lg overflow-x-auto my-3 font-mono text-xs text-slate-200">
                        <code {...props}>{children}</code>
                      </pre>
                    );
                  },
                  a: ({ ...props }) => (
                    <a className="text-indigo-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
                  ),
                  hr: ({ ...props }) => (
                    <hr className="border-slate-800 my-4" {...props} />
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            ) : (
              <div className="text-slate-600 text-xs italic">
                Nenhum conteúdo para visualização prévia.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Barra de Status Inferior */}
      <div className="h-7 border-t border-slate-800/80 px-4 bg-slate-950 flex items-center justify-between text-[11px] text-slate-500 select-none shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Type className="w-3 h-3 text-slate-500" />
            <span>{charCount} caracteres</span>
          </div>
          <span>•</span>
          <span>{wordCount} palavras</span>
          <span>•</span>
          <span>{lineCount} linhas</span>
        </div>

        <div className="flex items-center gap-2">
          {note.updated_at && (
            <span>
              Última alteração:{" "}
              {new Date(note.updated_at).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
