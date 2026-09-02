import { useState, useEffect, useCallback } from "react";
import {
  Database,
  DownloadSimple,
  Keyboard,
  UploadSimple,
  X,
  Check,
  WarningCircle,
  SpinnerGap,
  Trash,
  Warning,
} from "@phosphor-icons/react";
import { dbService } from "../services/db";

type Props = {
  open: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
};

const KEY_LABEL: Record<string, string> = {
  Control: "Ctrl",
  Shift: "Shift",
  Alt: "Alt",
  Meta: "Win",
  " ": "Space",
};

export function SettingsPanel({ open, onClose, onDataChanged }: Props) {
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState<string[]>(["Ctrl", "Shift", "Space"]);
  const [savedHotkey, setSavedHotkey] = useState<string>("Ctrl+Shift+Space");
  const [dbPath, setDbPath] = useState<string>("C:\\Users\\devca\\Documents\\MecNotes\\notas.db");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSavingHotkey, setIsSavingHotkey] = useState(false);
  const [isClearingNotes, setIsClearingNotes] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

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

  // Carregar configurações e caminho do banco SQLite
  useEffect(() => {
    if (!open) {
      setCapturing(false);
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
          const hk = loadedSettings.hotkey || "Ctrl+Shift+Space";
          setSavedHotkey(hk);
          setCaptured(hk.split("+"));
          setDbPath(loadedPath);
        }
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [open]);

  // Captura de atalho do teclado com preview dinâmico instantâneo
  useEffect(() => {
    if (!capturing) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setCaptured(savedHotkey.split("+"));
        setCapturing(false);
        return;
      }

      const mods: string[] = [];
      if (e.ctrlKey) mods.push("Control");
      if (e.shiftKey) mods.push("Shift");
      if (e.altKey) mods.push("Alt");
      if (e.metaKey) mods.push("Meta");

      const key = e.key;
      if (!["Control", "Shift", "Alt", "Meta"].includes(key)) {
        let label = KEY_LABEL[key] ?? (key.length === 1 ? key.toUpperCase() : key);
        if (label === " ") label = "Space";
        const finalKeys = [...mods.map((m) => KEY_LABEL[m] || m), label];
        setCaptured(finalKeys);
      } else {
        const currentMods = mods.map((m) => KEY_LABEL[m] || m);
        if (currentMods.length > 0) {
          setCaptured(currentMods);
        }
      }
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [capturing, savedHotkey]);

  // Fechar com Escape quando inativo
  useEffect(() => {
    if (!open || capturing || showClearConfirm) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, capturing, showClearConfirm, onClose]);

  // Salvar atalho capturado
  const handleSaveHotkey = async () => {
    const newHotkeyStr = captured.join("+");
    try {
      setIsSavingHotkey(true);
      await dbService.updateHotkeySetting(newHotkeyStr);
      setSavedHotkey(newHotkeyStr);
      setCapturing(false);
      showFeedback("success", `Atalho atualizado para: ${newHotkeyStr}`);
    } catch (err) {
      console.error("Erro ao salvar atalho:", err);
      showFeedback(
        "error",
        typeof err === "string" ? err : `Falha ao salvar atalho: ${newHotkeyStr}`
      );
    } finally {
      setIsSavingHotkey(false);
    }
  };

  // Exportar banco de dados
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

  // Importar banco de dados
  const handleImportDb = async () => {
    try {
      setIsImporting(true);
      const updatedSettings = await dbService.importDb();
      if (updatedSettings) {
        const hk = updatedSettings.hotkey || "Ctrl+Shift+Space";
        setSavedHotkey(hk);
        setCaptured(hk.split("+"));
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

  if (!open) return null;

  const isPendingChanges = captured.join("+") !== savedHotkey;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 select-none">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-label="Configurações"
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-app-border bg-app-sidebar shadow-2xl flex flex-col max-h-[85vh] text-app-text"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-app-border px-4 py-3 shrink-0 bg-app-dark">
          <h2 className="text-sm font-semibold text-white">Configurações</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-7 place-items-center rounded-md text-app-muted hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="text-base" />
          </button>
        </div>

        {/* Notificações / Feedbacks */}
        {feedback && (
          <div
            className={`mx-4 mt-3 px-3 py-2 rounded-lg flex items-center gap-2 text-xs border ${
              feedback.type === "success"
                ? "bg-emerald-950/60 border-emerald-800/80 text-emerald-300"
                : "bg-red-950/60 border-red-800/80 text-red-300"
            }`}
          >
            {feedback.type === "success" ? (
              <Check className="text-sm text-emerald-400 shrink-0" weight="bold" />
            ) : (
              <WarningCircle className="text-sm text-red-400 shrink-0" weight="fill" />
            )}
            <span className="leading-tight">{feedback.message}</span>
          </div>
        )}

        {/* Conteúdo com Scroll */}
        <div className="space-y-5 p-4 overflow-y-auto">
          {/* BLOCO 1: Atalho global de ativação */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <Keyboard className="text-base text-white shrink-0" />
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                Atalho global de ativação
              </h3>
            </div>
            <p className="mb-2.5 text-[12px] leading-relaxed text-app-muted">
              Invoca o MEC Notes instantaneamente de qualquer lugar do Windows. A nova tecla é salva no SQLite.
            </p>
            <div className="flex items-center gap-2">
              <div
                className={`flex flex-1 items-center gap-1.5 rounded-lg border border-app-border bg-app-dark px-3 py-2 transition ${
                  capturing ? "border-white/50 ring-1 ring-white/30" : ""
                }`}
              >
                {captured.length === 0 ? (
                  <span className="text-[12px] text-app-muted">
                    {capturing ? "Pressione as teclas no teclado…" : "Nenhum atalho configurado"}
                  </span>
                ) : (
                  captured.map((k, i) => (
                    <kbd
                      key={i}
                      className={`rounded border px-2 py-0.5 font-mono text-[11px] shadow-xs ${
                        capturing
                          ? "border-white/40 bg-zinc-700 text-white font-semibold"
                          : "border-app-border bg-zinc-800 text-white"
                      }`}
                    >
                      {k}
                    </kbd>
                  ))
                )}
                {capturing && (
                  <span className="ml-auto text-[10px] text-zinc-400 animate-pulse">
                    Gravando...
                  </span>
                )}
              </div>

              {isPendingChanges || capturing ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setCaptured(savedHotkey.split("+"));
                      setCapturing(false);
                    }}
                    disabled={isSavingHotkey}
                    className="rounded-lg border border-app-border bg-zinc-800 hover:bg-zinc-700 px-2.5 py-2 text-[12px] font-medium text-app-muted hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveHotkey}
                    disabled={isSavingHotkey}
                    className="flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-[12px] font-medium text-black transition-opacity hover:opacity-90 shadow-sm"
                  >
                    {isSavingHotkey ? (
                      <SpinnerGap className="text-sm animate-spin" />
                    ) : (
                      <Check className="text-sm font-bold" weight="bold" />
                    )}
                    <span>Salvar</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setCapturing(true);
                  }}
                  className="rounded-lg bg-white px-3 py-2 text-[12px] font-medium text-black transition-opacity hover:opacity-90 shadow-sm"
                >
                  Alterar
                </button>
              )}
            </div>
          </section>

          {/* BLOCO 2: Banco de dados */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <Database className="text-base text-white shrink-0" />
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                Banco de dados SQLite
              </h3>
            </div>
            <div className="rounded-lg border border-app-border bg-app-dark px-3 py-2">
              <span className="text-[10px] uppercase tracking-wider text-app-muted">
                Caminho do arquivo
              </span>
              <p className="mt-0.5 truncate font-mono text-[12px] text-zinc-300">
                {dbPath}
              </p>
            </div>
            <p className="mt-1.5 text-[11px] text-app-muted">
              Persistido com segurança em <code className="font-mono text-zinc-300">~/Documents/MecNotes</code>.
            </p>
          </section>

          {/* BLOCO 3: Importar / Exportar */}
          <section>
            <h3 className="mb-2 text-xs font-semibold text-white uppercase tracking-wider">
              Backup e Restauração
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExportDb}
                disabled={isExporting || isImporting}
                className="flex items-center justify-center gap-2 rounded-lg border border-app-border bg-app-dark px-3 py-2 text-[12px] font-medium text-app-text transition-colors hover:bg-zinc-800 disabled:opacity-50"
              >
                {isExporting ? (
                  <SpinnerGap className="text-base animate-spin" />
                ) : (
                  <DownloadSimple className="text-base" />
                )}
                <span>{isExporting ? "Aguardando..." : "Exportar tudo"}</span>
              </button>

              <button
                onClick={handleImportDb}
                disabled={isExporting || isImporting}
                className="flex items-center justify-center gap-2 rounded-lg border border-app-border bg-app-dark px-3 py-2 text-[12px] font-medium text-app-text transition-colors hover:bg-zinc-800 disabled:opacity-50"
              >
                {isImporting ? (
                  <SpinnerGap className="text-base animate-spin" />
                ) : (
                  <UploadSimple className="text-base" />
                )}
                <span>{isImporting ? "Aguardando..." : "Importar"}</span>
              </button>
            </div>
          </section>

          {/* BLOCO 4: Zona de Perigo / Limpar Notas */}
          <section className="border-t border-app-border pt-4">
            <h3 className="mb-2 text-xs font-semibold text-red-400 uppercase tracking-wider">
              Zona de Perigo
            </h3>

            {showClearConfirm ? (
              <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-3 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-medium text-red-400">
                  <Warning className="text-sm shrink-0" weight="fill" />
                  <span>Deseja apagar todas as notas do banco SQLite?</span>
                </div>
                <p className="text-[11px] text-app-muted leading-relaxed">
                  Esta ação é irreversível e limpará todas as notas salvas.
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    disabled={isClearingNotes}
                    className="rounded-lg border border-app-border bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 text-xs font-medium text-app-text transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleClearAllNotes}
                    disabled={isClearingNotes}
                    className="flex items-center gap-1 rounded-lg bg-red-600 hover:bg-red-500 px-3 py-1 text-xs font-medium text-white transition-opacity shadow-sm"
                  >
                    {isClearingNotes ? (
                      <SpinnerGap className="text-xs animate-spin" />
                    ) : (
                      <Trash className="text-xs" />
                    )}
                    <span>Confirmar Exclusão</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-app-border bg-app-dark p-3">
                <div>
                  <div className="text-xs font-medium text-app-text">
                    Limpar todas as notas
                  </div>
                  <div className="text-[11px] text-app-muted">
                    Apaga todas as notas sem resetar configurações.
                  </div>
                </div>
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium px-2.5 py-1.5 transition-colors shrink-0 ml-2"
                >
                  <Trash className="text-sm" />
                  <span>Limpar tudo</span>
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
