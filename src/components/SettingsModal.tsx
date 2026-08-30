import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Keyboard,
  Database,
  Download,
  Upload,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { dbService, AppSettings } from "../services/db";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
}) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [dbPath, setDbPath] = useState<string>("");
  const [isListeningHotkey, setIsListeningHotkey] = useState(false);
  const [pendingHotkey, setPendingHotkey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSavingHotkey, setIsSavingHotkey] = useState(false);
  const [isClearingNotes, setIsClearingNotes] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Exibir feedback com auto-dismiss após 4 segundos
  const showFeedback = useCallback(
    (type: "success" | "error", message: string) => {
      setFeedback({ type, message });
      const timer = setTimeout(() => {
        setFeedback(null);
      }, 4000);
      return () => clearTimeout(timer);
    },
    []
  );

  // Carregar dados de configurações e caminho do banco SQLite
  useEffect(() => {
    if (!isOpen) {
      setIsListeningHotkey(false);
      setPendingHotkey(null);
      setShowClearConfirm(false);
      setFeedback(null);
      return;
    }

    let isMounted = true;

    async function loadData() {
      try {
        const [loadedSettings, loadedPath] = await Promise.all([
          dbService.getSettings().catch(() => ({
            hotkey: "Ctrl+Shift+Space",
            theme: "dark",
            default_mode: "floating",
            auto_save_interval: 500,
          })),
          dbService.getDbPath().catch(() => "C:\\Users\\devca\\Documents\\MecNotes\\notas.db"),
        ]);

        if (isMounted) {
          setSettings(loadedSettings);
          setDbPath(loadedPath);
        }
      } catch (err) {
        console.error("Erro ao carregar dados do modal de configurações:", err);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Capturar nova combinação de teclas quando estiver em modo de escuta
  useEffect(() => {
    if (!isListeningHotkey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Cancelar com Escape
      if (e.key === "Escape") {
        setIsListeningHotkey(false);
        setPendingHotkey(null);
        return;
      }

      // Ignorar se apenas modificadores foram pressionados isoladamente
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
        return;
      }

      const keys: string[] = [];
      if (e.ctrlKey) keys.push("Ctrl");
      if (e.altKey) keys.push("Alt");
      if (e.shiftKey) keys.push("Shift");
      if (e.metaKey) keys.push("Super");

      // Tratar teclas especiais
      let mainKey = e.key;
      if (mainKey === " ") mainKey = "Space";
      else if (mainKey.length === 1) mainKey = mainKey.toUpperCase();

      keys.push(mainKey);
      const newHotkey = keys.join("+");

      setPendingHotkey(newHotkey);
      setIsListeningHotkey(false);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isListeningHotkey]);

  // Fechar com Escape quando não estiver capturando atalho nem confirmando exclusão
  useEffect(() => {
    if (!isOpen || isListeningHotkey || showClearConfirm) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, isListeningHotkey, showClearConfirm, onClose]);

  // Salvar novo atalho capturado
  const handleSaveHotkey = async () => {
    if (!pendingHotkey) return;
    try {
      setIsSavingHotkey(true);
      await dbService.updateHotkeySetting(pendingHotkey);
      setSettings((prev) => (prev ? { ...prev, hotkey: pendingHotkey } : null));
      showFeedback("success", `Atalho atualizado e salvo: ${pendingHotkey}`);
      setPendingHotkey(null);
    } catch (err) {
      console.error("Erro ao salvar atalho:", err);
      showFeedback(
        "error",
        typeof err === "string" ? err : `Falha ao salvar atalho: ${pendingHotkey}`
      );
    } finally {
      setIsSavingHotkey(false);
    }
  };

  // Cancelar alteração do atalho
  const handleCancelHotkey = () => {
    setIsListeningHotkey(false);
    setPendingHotkey(null);
  };

  // Exportar banco de dados (Abre diálogo nativo do Windows)
  const handleExportDb = async () => {
    try {
      setIsExporting(true);
      const res = await dbService.exportDb();
      if (res) {
        showFeedback("success", res);
      }
    } catch (err) {
      console.error("Erro ao exportar banco:", err);
      showFeedback(
        "error",
        typeof err === "string" ? err : "Erro ao exportar o banco de dados."
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Importar banco de dados (Abre diálogo nativo do Windows)
  const handleImportDb = async () => {
    try {
      setIsImporting(true);
      const updatedSettings = await dbService.importDb();
      if (updatedSettings) {
        setSettings(updatedSettings);
        showFeedback(
          "success",
          "Banco de dados importado e restaurado com sucesso!"
        );
        if (onDataChanged) {
          onDataChanged();
        }
      }
    } catch (err) {
      console.error("Erro ao importar banco:", err);
      showFeedback(
        "error",
        typeof err === "string" ? err : "Erro ao importar o banco de dados."
      );
    } finally {
      setIsImporting(false);
    }
  };

  // Limpar todas as notas
  const handleClearAllNotes = async () => {
    try {
      setIsClearingNotes(true);
      await dbService.clearAllNotes();
      showFeedback("success", "Todas as notas foram apagadas com sucesso!");
      setShowClearConfirm(false);
      if (onDataChanged) {
        onDataChanged();
      }
    } catch (err) {
      console.error("Erro ao limpar notas:", err);
      showFeedback(
        "error",
        typeof err === "string" ? err : "Erro ao limpar as notas."
      );
    } finally {
      setIsClearingNotes(false);
    }
  };

  if (!isOpen) return null;

  // Atalho ativo para exibição
  const activeHotkeyDisplay = pendingHotkey || settings?.hotkey || "Ctrl+Shift+Space";
  const hotkeyParts = activeHotkeyDisplay.split("+");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Cabeçalho */}
        <div className="h-12 px-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <h2 className="text-sm font-semibold tracking-wide text-slate-100">
            Configurações
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
            title="Fechar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notificações / Feedbacks */}
        {feedback && (
          <div
            className={`px-4 py-2.5 mx-5 mt-4 rounded-lg flex items-center gap-2 text-xs border ${
              feedback.type === "success"
                ? "bg-emerald-950/60 border-emerald-800/80 text-emerald-300"
                : "bg-red-950/60 border-red-800/80 text-red-300"
            }`}
          >
            {feedback.type === "success" ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span className="leading-tight">{feedback.message}</span>
          </div>
        )}

        {/* Corpo do Modal - Blocos Verticais */}
        <div className="p-5 space-y-6 overflow-y-auto max-h-[80vh]">
          {/* BLOCO 1: Atalho global de ativação */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-slate-200">
              <Keyboard className="w-4 h-4 text-indigo-400 shrink-0" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Atalho global de ativação
              </h3>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Invoca o MEC Notes instantaneamente de qualquer lugar do Windows. Clique em Alterar, pressione as teclas e clique em Salvar.
            </p>

            <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg p-3">
              {isListeningHotkey ? (
                <div className="flex items-center gap-2 text-xs text-amber-400 font-medium animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Pressione a nova combinação de teclas (Esc cancela)...</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {hotkeyParts.map((part, index) => (
                    <React.Fragment key={index}>
                      <kbd
                        className={`px-2.5 py-1 text-xs font-mono font-semibold rounded shadow-sm transition ${
                          pendingHotkey
                            ? "text-amber-200 bg-amber-950/60 border border-amber-500/50"
                            : "text-slate-200 bg-slate-800 border border-slate-700/80"
                        }`}
                      >
                        {part}
                      </kbd>
                      {index < hotkeyParts.length - 1 && (
                        <span className="text-slate-500 text-xs font-bold">+</span>
                      )}
                    </React.Fragment>
                  ))}
                  {pendingHotkey && (
                    <span className="text-[10px] text-amber-400 ml-1 font-medium">
                      (não salvo)
                    </span>
                  )}
                </div>
              )}

              {/* Botões de Ação para o Atalho */}
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {pendingHotkey ? (
                  <>
                    <button
                      onClick={handleCancelHotkey}
                      disabled={isSavingHotkey}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-md transition"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveHotkey}
                      disabled={isSavingHotkey}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-md transition shadow-sm"
                    >
                      {isSavingHotkey ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Salvar</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setPendingHotkey(null);
                      setIsListeningHotkey(true);
                    }}
                    disabled={isListeningHotkey}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-500 text-xs font-medium rounded-md transition shadow-sm"
                  >
                    {isListeningHotkey ? "Gravando..." : "Alterar"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Divisor */}
          <div className="border-t border-slate-800/80" />

          {/* BLOCO 2: Banco de dados */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-slate-200">
              <Database className="w-4 h-4 text-indigo-400 shrink-0" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Banco de dados
              </h3>
            </div>

            <div className="bg-slate-800/90 border border-slate-700/60 rounded-lg p-3 space-y-1.5 shadow-inner">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                CAMINHO DO ARQUIVO
              </div>
              <div className="font-mono text-xs text-indigo-200 bg-slate-950/80 px-2.5 py-1.5 rounded border border-slate-800/80 break-all select-all">
                {dbPath || "C:\\Users\\devca\\Documents\\MecNotes\\notas.db"}
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Resolvido automaticamente em ~/Documents/MecNotes pelo backend Rust.
            </p>
          </div>

          {/* Divisor */}
          <div className="border-t border-slate-800/80" />

          {/* BLOCO 3: Importar / Exportar */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Importar / Exportar
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleExportDb}
                disabled={isExporting || isImporting}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-50 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition shadow-sm"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                ) : (
                  <Download className="w-4 h-4 text-indigo-400" />
                )}
                <span>{isExporting ? "Aguardando..." : "Exportar tudo"}</span>
              </button>

              <button
                onClick={handleImportDb}
                disabled={isExporting || isImporting}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-50 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition shadow-sm"
              >
                {isImporting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                ) : (
                  <Upload className="w-4 h-4 text-indigo-400" />
                )}
                <span>{isImporting ? "Aguardando..." : "Importar"}</span>
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Abre a janela nativa do Windows para selecionar o arquivo e realizar o dump ou a restauração.
            </p>
          </div>

          {/* Divisor */}
          <div className="border-t border-slate-800/80" />

          {/* BLOCO 4: Gerenciamento de Dados / Limpar Notas */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400/90">
              Zona de Perigo
            </h3>

            {showClearConfirm ? (
              <div className="p-3.5 bg-red-950/50 border border-red-800/80 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-red-200">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Deseja realmente apagar todas as notas do banco?</span>
                </div>
                <p className="text-[11px] text-red-300/80 leading-relaxed">
                  Esta ação é irreversível e excluirá todo o histórico de notas salvas.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    disabled={isClearingNotes}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleClearAllNotes}
                    disabled={isClearingNotes}
                    className="flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded transition shadow-sm"
                  >
                    {isClearingNotes ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>Confirmar Exclusão</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg p-3">
                <div>
                  <div className="text-xs font-medium text-slate-200">
                    Limpar todas as notas
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Apaga todas as notas criadas sem afetar as configurações.
                  </div>
                </div>

                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/70 text-xs font-medium rounded-md transition shadow-sm shrink-0 ml-3"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>Limpar tudo</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
