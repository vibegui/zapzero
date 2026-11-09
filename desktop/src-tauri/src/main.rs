// zapzero desktop: starts the local server (a sidecar) and shows the panel in a window.
// The server reads WhatsApp's database read-only; give Full Disk Access to zapzero.app once and the
// sidecar inherits it. Nothing here clicks or types in WhatsApp.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::{SocketAddr, TcpStream};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::webview::NewWindowResponse;
use tauri::{Manager, RunEvent, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::{process::CommandChild, ShellExt};

struct Server(Mutex<Option<CommandChild>>);

fn port() -> u16 {
    std::env::var("ZAP_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8810)
}

fn up(port: u16) -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok()
}

fn token() -> Option<String> {
    let data = std::env::var("ZAP_DATA").unwrap_or_else(|_| {
        format!("{}/Library/Application Support/zap", std::env::var("HOME").unwrap_or_default())
    });
    std::fs::read_to_string(format!("{data}/token")).ok().map(|t| t.trim().to_string())
}

/// Links leave the app: the default browser opens them (macOS `open`), in its last window, like any other app.
/// Only the panel itself (127.0.0.1) and the loading page stay in the window.
fn external(url: &Url) -> bool {
    let local = matches!(url.host_str(), Some("127.0.0.1") | Some("localhost") | Some("tauri.localhost"));
    let open = matches!(url.scheme(), "http" | "https" | "mailto") && !local;
    if open {
        let _ = std::process::Command::new("/usr/bin/open").arg(url.as_str()).spawn();
    }
    open
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let port = port();
            let mut child = None;
            // the launchd agent from `bun run setup` may already serve it: use that one
            if !up(port) {
                let dir = app.path().resource_dir()?;
                let (_rx, c) = app
                    .shell()
                    .sidecar("zapzero-server")?
                    .args(["serve"])
                    .current_dir(dir) // dist/ (the panel) sits next to it
                    .env("PATH", "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin")
                    .spawn()?;
                child = Some(c);
            }
            app.manage(Server(Mutex::new(child)));

            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("zapzero")
                .inner_size(1280.0, 820.0)
                .min_inner_size(900.0, 600.0)
                .on_navigation(|url| !external(url))
                .on_new_window(|url, _| {
                    external(&url);
                    NewWindowResponse::Deny
                })
                .build()?;
            std::thread::spawn(move || {
                let start = Instant::now();
                while !up(port) && start.elapsed() < Duration::from_secs(30) {
                    std::thread::sleep(Duration::from_millis(200));
                }
                let t = token().unwrap_or_default();
                if let Ok(url) = Url::parse(&format!("http://127.0.0.1:{port}/?t={t}")) {
                    let _ = window.navigate(url);
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("zapzero failed to start");

    app.run(|app, event| {
        if let RunEvent::Exit = event {
            if let Some(c) = app.state::<Server>().0.lock().unwrap().take() {
                let _ = c.kill();
            }
        }
    });
}
