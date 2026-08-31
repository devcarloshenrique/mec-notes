pub mod db;

pub mod commands {
    use std::path::PathBuf;
    use tauri::{
        AppHandle, LogicalSize, Manager, PhysicalPosition, Position, Size, State, WebviewUrl,
        WebviewWindow, WebviewWindowBuilder,
    };
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

    use crate::db::{
        db_clear_all_notes, db_delete_note, db_export_to, db_get_note_by_id, db_get_notes,
        db_get_open_sticky_windows, db_get_settings, db_get_sticky_window, db_import_from,
        db_save_note, db_save_sticky_geometry, db_set_sticky_open, db_update_setting, AppSettings,
        DbState, Note, StickyWindow,
    };

    // ==========================================
    // Comandos de Janela e Atalhos
    // ==========================================

    #[tauri::command]
    pub fn toggle_window_visibility(app: AppHandle) -> Result<bool, String> {
        if let Some(window) = app.get_webview_window("main") {
            let is_visible = window.is_visible().map_err(|e| e.to_string())?;
            if is_visible {
                window.hide().map_err(|e| e.to_string())?;
                Ok(false)
            } else {
                window.show().map_err(|e| e.to_string())?;
                window.set_focus().map_err(|e| e.to_string())?;
                Ok(true)
            }
        } else {
            Err("Janela principal não encontrada".to_string())
        }
    }

    #[tauri::command]
    pub fn set_floating_mode(window: WebviewWindow) -> Result<(), String> {
        // Configurações para modo flutuante: sem decorações, sempre no topo, canto inferior direito
        window.set_decorations(false).map_err(|e| e.to_string())?;
        window.set_always_on_top(true).map_err(|e| e.to_string())?;
        window.set_resizable(true).map_err(|e| e.to_string())?;
        window.set_skip_taskbar(false).map_err(|e| e.to_string())?;

        let width = 380.0;
        let height = 520.0;
        window
            .set_size(Size::Logical(LogicalSize { width, height }))
            .map_err(|e| e.to_string())?;

        // Posicionar no canto inferior direito do monitor atual
        if let Ok(Some(monitor)) = window.current_monitor() {
            let screen_size = monitor.size();
            let scale_factor = monitor.scale_factor();
            let screen_width = screen_size.width as f64 / scale_factor;
            let screen_height = screen_size.height as f64 / scale_factor;

            let margin = 24.0;
            let taskbar_margin = 48.0; // Margem para barra de tarefas do Windows
            let x = (screen_width - width - margin).max(0.0);
            let y = (screen_height - height - taskbar_margin).max(0.0);

            let phys_x = (x * scale_factor) as i32;
            let phys_y = (y * scale_factor) as i32;

            window
                .set_position(Position::Physical(PhysicalPosition {
                    x: phys_x,
                    y: phys_y,
                }))
                .map_err(|e| e.to_string())?;
        }

        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        Ok(())
    }

    #[tauri::command]
    pub fn set_window_mode(window: WebviewWindow) -> Result<(), String> {
        // Configurações para modo janela: sem decorações nativas (usa custom titlebar), centralizado e redimensionável
        window.set_decorations(false).map_err(|e| e.to_string())?;
        window.set_always_on_top(false).map_err(|e| e.to_string())?;
        window.set_resizable(true).map_err(|e| e.to_string())?;
        window.set_skip_taskbar(false).map_err(|e| e.to_string())?;

        let width = 850.0;
        let height = 600.0;
        window
            .set_size(Size::Logical(LogicalSize { width, height }))
            .map_err(|e| e.to_string())?;
        window.center().map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        Ok(())
    }

    #[tauri::command]
    pub fn minimize_to_tray(window: WebviewWindow) -> Result<(), String> {
        window.hide().map_err(|e| e.to_string())?;
        Ok(())
    }

    #[tauri::command]
    pub fn register_global_shortcut(app: AppHandle, shortcut_str: String) -> Result<(), String> {
        // Normaliza aliases comuns (ex: Control -> Ctrl, Super -> Win) para o parser do Shortcut
        let normalized = shortcut_str
            .replace("Control", "Ctrl")
            .replace("Meta", "Super")
            .replace("Win", "Super");

        let shortcut: Shortcut = normalized
            .parse()
            .map_err(|e| format!("Atalho inválido '{}': {}", shortcut_str, e))?;

        let global_shortcut_plugin = app.global_shortcut();

        // Desregistra todos os atalhos anteriores gerenciados
        let _ = global_shortcut_plugin.unregister_all();

        // Registra o novo atalho - o handler global configurado no builder responderá ao evento
        global_shortcut_plugin
            .register(shortcut)
            .map_err(|e| format!("Falha ao registrar atalho global '{}': {}", shortcut_str, e))?;

        Ok(())
    }

    // ==========================================
    // Comandos de Notas Adesivas (Sticky Notes)
    // ==========================================

    pub fn sticky_window_label(note_id: &str) -> String {
        format!("sticky-{}", note_id)
    }

    pub fn create_or_show_sticky_window(
        app: &AppHandle,
        note_id: &str,
        x: Option<f64>,
        y: Option<f64>,
        width: Option<f64>,
        height: Option<f64>,
    ) -> Result<WebviewWindow, String> {
        let label = sticky_window_label(note_id);

        if let Some(existing_window) = app.get_webview_window(&label) {
            let _ = existing_window.show();
            let _ = existing_window.set_focus();
            return Ok(existing_window);
        }

        let w = width.unwrap_or(280.0).max(180.0);
        let h = height.unwrap_or(280.0).max(150.0);

        let webview_url = WebviewUrl::App("index.html".into());

        let builder = WebviewWindowBuilder::new(app, &label, webview_url)
            .title("Nota Adesiva")
            .inner_size(w, h)
            .min_inner_size(180.0, 150.0)
            .decorations(false)
            .skip_taskbar(true)
            .always_on_top(false)
            .transparent(false)
            .background_color(tauri::window::Color(15, 15, 16, 255))
            .resizable(true)
            .shadow(true);

        let builder = if let (Some(pos_x), Some(pos_y)) = (x, y) {
            builder.position(pos_x, pos_y)
        } else {
            builder
        };

        let window = builder
            .build()
            .map_err(|e| format!("Falha ao criar janela da nota adesiva '{}': {}", note_id, e))?;

        if x.is_none() || y.is_none() {
            let _ = window.center();
        }

        let _ = window.show();
        let _ = window.set_focus();

        Ok(window)
    }

    #[tauri::command]
    pub fn open_sticky_note(
        app: AppHandle,
        state: State<'_, DbState>,
        note_id: String,
        x: Option<f64>,
        y: Option<f64>,
        width: Option<f64>,
        height: Option<f64>,
    ) -> Result<StickyWindow, String> {
        // Obter configuração prévia do banco liberando o lock imediatamente antes de criar a janela Tauri
        let saved = {
            let conn = state
                .conn
                .lock()
                .map_err(|_| "Falha ao obter lock do banco de dados".to_string())?;
            db_get_sticky_window(&conn, &note_id)?
        };

        let (use_x, use_y, use_w, use_h) = match (saved.as_ref(), x, y, width, height) {
            (Some(s), None, None, None, None) => (Some(s.x), Some(s.y), Some(s.width), Some(s.height)),
            _ => (
                x.or_else(|| saved.as_ref().map(|s| s.x)),
                y.or_else(|| saved.as_ref().map(|s| s.y)),
                width.or_else(|| saved.as_ref().map(|s| s.width)).or(Some(280.0)),
                height.or_else(|| saved.as_ref().map(|s| s.height)).or(Some(280.0)),
            ),
        };

        // Criação e exibição da janela Tauri sem segurar lock do SQLite
        let _ = create_or_show_sticky_window(&app, &note_id, use_x, use_y, use_w, use_h)?;

        let final_x = use_x.unwrap_or(100.0);
        let final_y = use_y.unwrap_or(100.0);
        let final_w = use_w.unwrap_or(280.0);
        let final_h = use_h.unwrap_or(280.0);

        // Persistir a geometria inicial/restaurada de forma rápida sem chamadas síncronas de inspeção de janela
        {
            let conn = state
                .conn
                .lock()
                .map_err(|_| "Falha ao obter lock do banco de dados".to_string())?;
            db_save_sticky_geometry(&conn, &note_id, final_x, final_y, final_w, final_h)?;
        }

        Ok(StickyWindow {
            note_id,
            x: final_x,
            y: final_y,
            width: final_w,
            height: final_h,
            is_open: true,
            updated_at: "now".to_string(),
        })
    }

    #[tauri::command]
    pub fn close_sticky_note(
        app: AppHandle,
        state: State<'_, DbState>,
        note_id: String,
    ) -> Result<bool, String> {
        let label = sticky_window_label(&note_id);
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.close();
        }

        let conn = state
            .conn
            .lock()
            .map_err(|_| "Falha ao obter lock do banco de dados".to_string())?;

        db_set_sticky_open(&conn, &note_id, false)?;
        Ok(true)
    }

    #[tauri::command]
    pub fn save_sticky_geometry(
        state: State<'_, DbState>,
        note_id: String,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    ) -> Result<(), String> {
        let conn = state
            .conn
            .lock()
            .map_err(|_| "Falha ao obter lock do banco de dados".to_string())?;

        db_save_sticky_geometry(&conn, &note_id, x, y, width, height)?;
        Ok(())
    }

    #[tauri::command]
    pub fn get_open_sticky_windows(state: State<'_, DbState>) -> Result<Vec<StickyWindow>, String> {
        let conn = state
            .conn
            .lock()
            .map_err(|_| "Falha ao obter lock do banco de dados".to_string())?;

        db_get_open_sticky_windows(&conn)
    }

    // ==========================================
    // Comandos SQLite de Notas (CRUD)
    // ==========================================

    #[tauri::command]
    pub fn get_notes(state: State<'_, DbState>) -> Result<Vec<Note>, String> {
        let conn = state
            .conn
            .lock()
            .map_err(|_| "Falha ao obter lock do banco de dados".to_string())?;
        db_get_notes(&conn)
    }

    #[tauri::command]
    pub fn get_note_by_id(state: State<'_, DbState>, id: String) -> Result<Option<Note>, String> {
        let conn = state
            .conn
            .lock()
            .map_err(|_| "Falha ao obter lock do banco de dados".to_string())?;
        db_get_note_by_id(&conn, &id)
    }

    #[tauri::command]
    pub fn save_note(state: State<'_, DbState>, note: Note) -> Result<Note, String> {
        let conn = state
            .conn
            .lock()
            .map_err(|_| "Falha ao obter lock do banco de dados".to_string())?;
        db_save_note(&conn, note)
    }

    #[tauri::command]
    pub fn delete_note(
        app: AppHandle,
        state: State<'_, DbState>,
        id: String,
    ) -> Result<bool, String> {
        // Se a nota estiver aberta como sticky, fechar a janela correspondente
        let label = sticky_window_label(&id);
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.close();
        }

        let conn = state
            .conn
            .lock()
            .map_err(|_| "Falha ao obter lock do banco de dados".to_string())?;
        db_delete_note(&conn, &id)
    }

    #[tauri::command]
    pub fn clear_all_notes(app: AppHandle, state: State<'_, DbState>) -> Result<usize, String> {
        // Fechar todas as janelas sticky abertas
        for (label, window) in app.webview_windows() {
            if label.starts_with("sticky-") {
                let _ = window.close();
            }
        }

        let conn = state
            .conn
            .lock()
            .map_err(|_| "Falha ao obter lock do banco de dados".to_string())?;
        db_clear_all_notes(&conn)
    }

    // ==========================================
    // Comandos SQLite de Configurações
    // ==========================================

    #[tauri::command]
    pub fn get_settings(state: State<'_, DbState>) -> Result<AppSettings, String> {
        let conn = state
            .conn
            .lock()
            .map_err(|_| "Falha ao obter lock do banco de dados".to_string())?;
        db_get_settings(&conn)
    }

    #[tauri::command]
    pub fn update_hotkey_setting(
        app: AppHandle,
        state: State<'_, DbState>,
        hotkey: String,
    ) -> Result<(), String> {
        // Valida e registra o atalho global primeiro
        register_global_shortcut(app, hotkey.clone())?;

        // Atualiza a configuração no SQLite
        let conn = state
            .conn
            .lock()
            .map_err(|_| "Falha ao obter lock do banco de dados".to_string())?;
        db_update_setting(&conn, "hotkey", &hotkey)?;

        Ok(())
    }

    // ==========================================
    // Comandos de Exportação e Importação de Banco
    // ==========================================

    #[tauri::command]
    pub fn export_db(
        state: State<'_, DbState>,
        destination_path: Option<String>,
    ) -> Result<Option<String>, String> {
        let dest = if let Some(path_str) = destination_path {
            PathBuf::from(path_str)
        } else {
            // Abrir diálogo nativo do sistema para salvar arquivo
            let default_dir = dirs::document_dir().unwrap_or_else(|| PathBuf::from("."));
            let file = rfd::FileDialog::new()
                .set_title("Exportar Banco de Dados SQLite")
                .set_directory(&default_dir)
                .set_file_name("notas_backup.db")
                .add_filter("SQLite Database (*.db, *.sqlite)", &["db", "sqlite"])
                .save_file();

            match file {
                Some(p) => p,
                None => return Ok(None), // Usuário cancelou o diálogo
            }
        };

        db_export_to(&state.db_path, &dest)?;
        Ok(Some(format!(
            "Banco de dados exportado com sucesso para: {}",
            dest.display()
        )))
    }

    #[tauri::command]
    pub fn import_db(
        app: AppHandle,
        state: State<'_, DbState>,
        source_path: Option<String>,
    ) -> Result<Option<AppSettings>, String> {
        let src = if let Some(path_str) = source_path {
            PathBuf::from(path_str)
        } else {
            // Abrir diálogo nativo do sistema para selecionar arquivo
            let default_dir = dirs::document_dir().unwrap_or_else(|| PathBuf::from("."));
            let file = rfd::FileDialog::new()
                .set_title("Importar Banco de Dados SQLite")
                .set_directory(&default_dir)
                .add_filter("SQLite Database (*.db, *.sqlite)", &["db", "sqlite"])
                .pick_file();

            match file {
                Some(p) => p,
                None => return Ok(None), // Usuário cancelou o diálogo
            }
        };

        let settings = db_import_from(&state, &src)?;

        // Re-sincroniza o atalho global conforme as configurações importadas
        if !settings.hotkey.is_empty() {
            let _ = register_global_shortcut(app, settings.hotkey.clone());
        }

        Ok(Some(settings))
    }

    #[tauri::command]
    pub fn export_notes_db(
        state: State<'_, DbState>,
        destination_path: String,
    ) -> Result<String, String> {
        let dest = PathBuf::from(&destination_path);
        db_export_to(&state.db_path, &dest)?;
        Ok(format!(
            "Banco de dados exportado com sucesso para: {}",
            dest.display()
        ))
    }

    #[tauri::command]
    pub fn import_notes_db(
        app: AppHandle,
        state: State<'_, DbState>,
        source_path: String,
    ) -> Result<AppSettings, String> {
        let src = PathBuf::from(&source_path);
        let settings = db_import_from(&state, &src)?;

        // Re-sincroniza o atalho global conforme as configurações importadas
        if !settings.hotkey.is_empty() {
            let _ = register_global_shortcut(app, settings.hotkey.clone());
        }

        Ok(settings)
    }

    #[tauri::command]
    pub fn get_db_path(state: State<'_, DbState>) -> Result<String, String> {
        Ok(state.db_path.to_string_lossy().to_string())
    }
}

use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_global_shortcut::ShortcutState;

use crate::db::{get_default_db_path, init_db, DbState};

pub fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show", "Abrir Notas", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide", "Ocultar", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Mec Notes - Bloco de Notas Rápido")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                let _ = commands::toggle_window_visibility(app.clone());
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg(test)]
mod tests;

pub fn run() {
    let db_path = get_default_db_path().expect("Falha ao resolver caminho de ~/Documents/MecNotes/notas.db");
    log::info!("Inicializando banco de dados SQLite em: {:?}", db_path);

    let conn = init_db(&db_path).expect("Falha ao inicializar banco de dados SQLite");
    let db_state = DbState {
        conn: Mutex::new(conn),
        db_path,
    };

    tauri::Builder::default()
        .manage(db_state)
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        let _ = commands::toggle_window_visibility(app.clone());
                    }
                })
                .build(),
        )
        .setup(|app| {
            // Configura o ícone nativo da barra de tarefas e da bandeja
            let icon = app.default_window_icon().cloned();

            setup_tray(app)?;

            // Iniciar com posição do modo flutuante e aplicar ícone explícito na janela
            if let Some(window) = app.get_webview_window("main") {
                if let Some(ref ic) = icon {
                    let _ = window.set_icon(ic.clone());
                }
                let _ = commands::set_floating_mode(window);
            }

            // Carrega e registra o atalho global persistido no SQLite e restaura Sticky Windows abertas
            let state = app.state::<DbState>();
            let (hotkey, open_windows) = {
                if let Ok(conn) = state.conn.lock() {
                    let hotkey = crate::db::db_get_settings(&conn)
                        .map(|s| s.hotkey)
                        .unwrap_or_default();
                    let windows = crate::db::db_get_open_sticky_windows(&conn).unwrap_or_default();
                    (hotkey, windows)
                } else {
                    (String::new(), Vec::new())
                }
            };

            if !hotkey.is_empty() {
                let _ = commands::register_global_shortcut(app.handle().clone(), hotkey);
            }

            // Restauração de janelas de Notas Adesivas abertas (is_open = 1) sem segurar o lock do SQLite
            for win in open_windows {
                let _ = commands::create_or_show_sticky_window(
                    app.handle(),
                    &win.note_id,
                    Some(win.x),
                    Some(win.y),
                    Some(win.width),
                    Some(win.height),
                );
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::toggle_window_visibility,
            commands::set_floating_mode,
            commands::set_window_mode,
            commands::minimize_to_tray,
            commands::register_global_shortcut,
            commands::open_sticky_note,
            commands::close_sticky_note,
            commands::save_sticky_geometry,
            commands::get_open_sticky_windows,
            commands::get_notes,
            commands::get_note_by_id,
            commands::save_note,
            commands::delete_note,
            commands::clear_all_notes,
            commands::get_settings,
            commands::update_hotkey_setting,
            commands::export_db,
            commands::import_db,
            commands::export_notes_db,
            commands::import_notes_db,
            commands::get_db_path,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar aplicação Tauri");
}
