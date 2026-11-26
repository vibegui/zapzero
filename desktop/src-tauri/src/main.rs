// zapzero desktop: starts the local server (a sidecar), shows the panel in a window, and keeps an icon in
// the menu bar with the number of urgent chats. The server reads WhatsApp's database read-only; give Full
// Disk Access to zapzero.app once and the sidecar inherits it. Nothing here clicks or types in WhatsApp.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::webview::NewWindowResponse;
use tauri::{
    AppHandle, Manager, RunEvent, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent, Wry,
};
use tauri_plugin_shell::{process::CommandChild, ShellExt};

struct Server(Mutex<Option<CommandChild>>);

const TRAY: &str = "zap";
/// Most urgent chats listed in the menu; the count next to the icon is the full number.
const MENU_ITEMS: usize = 8;

fn port() -> u16 {
    std::env::var("ZAP_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8810)
}

fn up(port: u16) -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok()
}

fn token() -> Option<String> {
    let data = std::env::var("ZAP_DATA").unwrap_or_else(|_| {
        format!(
            "{}/Library/Application Support/zap",
            std::env::var("HOME").unwrap_or_default()
        )
    });
    std::fs::read_to_string(format!("{data}/token"))
        .ok()
        .map(|t| t.trim().to_string())
}

/// One request to the local server. HTTP/1.0, so the body is never chunked and ends when the socket closes.
fn call(method: &str, path: &str) -> Option<serde_json::Value> {
    let addr = SocketAddr::from(([127, 0, 0, 1], port()));
    let mut s = TcpStream::connect_timeout(&addr, Duration::from_secs(1)).ok()?;
    s.set_read_timeout(Some(Duration::from_secs(10))).ok()?;
    let t = token()?;
    write!(s, "{method} {path} HTTP/1.0\r\nHost: 127.0.0.1\r\nx-zap-token: {t}\r\nContent-Length: 0\r\n\r\n").ok()?;
    let mut buf = Vec::new();
    s.read_to_end(&mut buf).ok()?;
    let at = buf.windows(4).position(|w| w == b"\r\n\r\n")? + 4;
    if !buf.starts_with(b"HTTP/1.1 200") && !buf.starts_with(b"HTTP/1.0 200") {
        return None;
    }
    serde_json::from_slice(&buf[at..]).ok()
}

/// Links leave the app: the default browser opens them (macOS `open`), in its last window, like any other app.
/// Only the panel itself (127.0.0.1) and the loading page stay in the window.
fn external(url: &Url) -> bool {
    let local = matches!(
        url.host_str(),
        Some("127.0.0.1") | Some("localhost") | Some("tauri.localhost")
    );
    let open = matches!(url.scheme(), "http" | "https" | "mailto") && !local;
    if open {
        let _ = std::process::Command::new("/usr/bin/open")
            .arg(url.as_str())
            .spawn();
    }
    open
}

/// Brings the window back and, with a path, opens the panel there (e.g. a chat).
fn show(app: &AppHandle, path: Option<&str>) {
    let Some(w) = app.get_webview_window("main") else {
        return;
    };
    if let Some(p) = path {
        let t = token().unwrap_or_default();
        if let Ok(url) = Url::parse(&format!(
            "http://127.0.0.1:{}{p}{}t={t}",
            port(),
            if p.contains('?') { "&" } else { "?" }
        )) {
            let _ = w.navigate(url);
        }
    }
    let _ = w.show();
    let _ = w.unminimize();
    let _ = w.set_focus();
}

fn items(inbox: &serde_json::Value, id: &str) -> Vec<serde_json::Value> {
    inbox["categories"]
        .as_array()
        .and_then(|cs| cs.iter().find(|c| c["id"] == id))
        .and_then(|c| c["items"].as_array().cloned())
        .unwrap_or_default()
}

fn clip(s: &str, n: usize) -> String {
    if s.chars().count() <= n {
        return s.to_string();
    }
    format!("{}…", s.chars().take(n - 1).collect::<String>())
}

/// The menu for one read of the inbox. `None` = the server did not answer.
fn menu(app: &AppHandle, inbox: Option<&serde_json::Value>) -> tauri::Result<Menu<Wry>> {
    let m = Menu::new(app)?;
    let sep = || PredefinedMenuItem::separator(app);
    match inbox {
        None => m.append(&MenuItem::with_id(
            app,
            "none",
            "zapzero não está rodando",
            false,
            None::<&str>,
        )?)?,
        Some(inbox) => {
            let urgent = items(inbox, "urgente");
            let head = match urgent.len() {
                0 => "Nada urgente agora".to_string(),
                1 => "1 urgente".to_string(),
                n => format!("{n} urgentes"),
            };
            m.append(&MenuItem::with_id(app, "head", head, false, None::<&str>)?)?;
            for i in urgent.iter().take(MENU_ITEMS) {
                let name = clip(i["name"].as_str().unwrap_or("?"), 28);
                let why = i["reason"].as_str().unwrap_or("");
                let label = if why.is_empty() {
                    name
                } else {
                    format!("{name} — {}", clip(why, 40))
                };
                let id = format!("chat:{}", i["pk"]);
                m.append(&MenuItem::with_id(app, id, label, true, None::<&str>)?)?;
            }
            if urgent.len() > MENU_ITEMS {
                let more = format!("Ver todas as {} urgentes…", urgent.len());
                m.append(&MenuItem::with_id(app, "all", more, true, None::<&str>)?)?;
            }
            m.append(&sep()?)?;
            let (week, old) = (items(inbox, "semana").len(), items(inbox, "antigas").len());
            let rest = format!("Semana {week} · Antigas {old}");
            m.append(&MenuItem::with_id(app, "week", rest, true, None::<&str>)?)?;
        }
    }
    m.append(&sep()?)?;
    m.append(&MenuItem::with_id(
        app,
        "open",
        "Abrir zapzero",
        true,
        Some("CmdOrCtrl+O"),
    )?)?;
    m.append(&MenuItem::with_id(
        app,
        "refresh",
        "Atualizar agora",
        true,
        Some("CmdOrCtrl+R"),
    )?)?;
    m.append(&sep()?)?;
    m.append(&MenuItem::with_id(
        app,
        "quit",
        "Sair do zapzero",
        true,
        Some("CmdOrCtrl+Q"),
    )?)?;
    Ok(m)
}

/// Reads the inbox and redraws the count and the menu.
fn redraw(app: &AppHandle) {
    let inbox = call("GET", "/api/inbox");
    let Some(tray) = app.tray_by_id(TRAY) else {
        return;
    };
    let n = inbox
        .as_ref()
        .map(|b| items(b, "urgente").len())
        .unwrap_or(0);
    let _ = tray.set_title(if n > 0 { Some(n.to_string()) } else { None });
    let _ = tray.set_tooltip(Some(format!("zapzero: {n} urgente(s)")));
    if let Ok(m) = menu(app, inbox.as_ref()) {
        let _ = tray.set_menu(Some(m));
    }
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
                    .env(
                        "PATH",
                        "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
                    )
                    .spawn()?;
                child = Some(c);
            }
            app.manage(Server(Mutex::new(child)));

            let window =
                WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                    .title("zapzero")
                    .inner_size(1280.0, 820.0)
                    .min_inner_size(900.0, 600.0)
                    .on_navigation(|url| !external(url))
                    .on_new_window(|url, _| {
                        external(&url);
                        NewWindowResponse::Deny
                    })
                    .build()?;
            // closing the window hides it: the menu bar icon keeps counting
            let w = window.clone();
            window.on_window_event(move |e| {
                if let WindowEvent::CloseRequested { api, .. } = e {
                    api.prevent_close();
                    let _ = w.hide();
                }
            });

            let handle = app.handle().clone();
            TrayIconBuilder::with_id(TRAY)
                .icon(Image::from_bytes(include_bytes!("../icons/tray.png"))?)
                .icon_as_template(true)
                .menu(&menu(&handle, None)?)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, e| match e.id().as_ref() {
                    "open" => show(app, None),
                    "all" => show(app, Some("/c/urgente")),
                    "week" => show(app, Some("/c/semana")),
                    "quit" => app.exit(0),
                    "refresh" => {
                        let app = app.clone();
                        std::thread::spawn(move || {
                            let _ = call("POST", "/api/refresh");
                            redraw(&app);
                        });
                    }
                    id => {
                        if let Some(pk) = id.strip_prefix("chat:") {
                            show(app, Some(&format!("/c/urgente?pk={pk}")));
                        }
                    }
                })
                .build(app)?;

            std::thread::spawn(move || {
                let start = Instant::now();
                while !up(port) && start.elapsed() < Duration::from_secs(30) {
                    std::thread::sleep(Duration::from_millis(200));
                }
                let t = token().unwrap_or_default();
                if let Ok(url) = Url::parse(&format!("http://127.0.0.1:{port}/?t={t}")) {
                    let _ = window.navigate(url);
                }
                loop {
                    redraw(&handle);
                    std::thread::sleep(Duration::from_secs(30));
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("zapzero failed to start");

    app.run(|app, event| match event {
        // a click on the Dock icon brings the hidden window back
        #[cfg(target_os = "macos")]
        RunEvent::Reopen { .. } => show(app, None),
        RunEvent::Exit => {
            if let Some(c) = app.state::<Server>().0.lock().unwrap().take() {
                let _ = c.kill();
            }
        }
        _ => {}
    });
}
