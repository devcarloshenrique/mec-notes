#[cfg(test)]
mod tests {
    #[test]
    fn test_shortcut_parsing() {
        use tauri_plugin_global_shortcut::Shortcut;
        let s = "Ctrl+Shift+Space".parse::<Shortcut>();
        assert!(s.is_ok());
    }
}
