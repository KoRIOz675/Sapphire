//! Keeps the main window on the app's own pages.
//!
//! Notes and company websites can hold links from imported files. Clicking one
//! must not replace the app with a remote page (no address bar, no way back):
//! http(s) links open in the system browser instead, anything else is blocked.

use tauri::{plugin::TauriPlugin, Manager, Runtime, Url};
use tauri_plugin_opener::OpenerExt;

#[derive(Debug, PartialEq)]
enum Navigation {
    Stay,
    OpenInBrowser,
    Block,
}

/// The app is served from `tauri://localhost` (Linux/macOS),
/// `http(s)://tauri.localhost` (Windows) or the Vite dev server on localhost.
fn classify(url: &Url) -> Navigation {
    let host = url.host_str().unwrap_or_default();
    match url.scheme() {
        "tauri" => Navigation::Stay,
        "http" | "https" if host == "tauri.localhost" => Navigation::Stay,
        "http" if cfg!(dev) && host == "localhost" => Navigation::Stay,
        "http" | "https" => Navigation::OpenInBrowser,
        _ => Navigation::Block,
    }
}

pub fn guard<R: Runtime>() -> TauriPlugin<R> {
    tauri::plugin::Builder::new("navigation-guard")
        .on_navigation(|webview, url| match classify(url) {
            Navigation::Stay => true,
            Navigation::OpenInBrowser => {
                let _ = webview
                    .app_handle()
                    .opener()
                    .open_url(url.as_str(), None::<&str>);
                false
            }
            Navigation::Block => false,
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn nav(url: &str) -> Navigation {
        classify(&Url::parse(url).unwrap())
    }

    #[test]
    fn app_pages_stay_in_the_window() {
        assert_eq!(nav("tauri://localhost/people/1"), Navigation::Stay);
        assert_eq!(nav("http://tauri.localhost/people/1"), Navigation::Stay);
    }

    #[test]
    fn web_links_open_in_the_browser() {
        assert_eq!(nav("https://example.com/"), Navigation::OpenInBrowser);
        assert_eq!(nav("http://evil.example/login"), Navigation::OpenInBrowser);
    }

    #[test]
    fn other_schemes_are_blocked() {
        assert_eq!(nav("file:///etc/passwd"), Navigation::Block);
        assert_eq!(nav("javascript:alert(1)"), Navigation::Block);
        assert_eq!(nav("data:text/html,hi"), Navigation::Block);
    }
}
