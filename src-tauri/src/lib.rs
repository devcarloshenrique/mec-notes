pub mod commands {
    use tauri::{
        AppHandle, LogicalSize, Manager, PhysicalPosition, Position, Size, WebviewWindow,
    };
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

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
        // Configurações para modo janela: com decorações, centralizado e redimensionável
        window.set_decorations(true).map_err(|e| e.to_string())?;
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
        let shortcut: Shortcut = shortcut_str
            .parse()
            .map_err(|_| format!("Atalho inválido: {}", shortcut_str))?;

        let global_shortcut_plugin = app.global_shortcut();

        // Desregistra todos os atalhos anteriores gerenciados
        let _ = global_shortcut_plugin.unregister_all();

        global_shortcut_plugin
            .on_shortcut(shortcut, move |app_handle, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    let _ = toggle_window_visibility(app_handle.clone());
                }
            })
            .map_err(|e| format!("Falha ao registrar atalho global: {}", e))?;

        Ok(())
    }
}

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_global_shortcut::ShortcutState;

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
    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcut("Ctrl+Shift+Space")
                .map(|b| {
                    b.with_handler(|app, _shortcut, event| {
                        if event.state() == ShortcutState::Pressed {
                            let _ = commands::toggle_window_visibility(app.clone());
                        }
                    })
                })
                .unwrap_or_else(|_| tauri_plugin_global_shortcut::Builder::new())
                .build(),
        )
        .setup(|app| {
            setup_tray(app)?;

            // Iniciar com posição do modo flutuante
            if let Some(window) = app.get_webview_window("main") {
                let _ = commands::set_floating_mode(window);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::toggle_window_visibility,
            commands::set_floating_mode,
            commands::set_window_mode,
            commands::minimize_to_tray,
            commands::register_global_shortcut
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar aplicação Tauri");
}
