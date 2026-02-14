use crate::error::AppError;
use crate::launchctl;
use crate::plist_util;
use crate::types::PlistConfig;
use crate::types::{JobListEntry, JobStatus, LaunchdJob};
use std::collections::HashMap;

fn ensure_user_agent(plist_path: &str) -> Result<(), AppError> {
    let home = dirs::home_dir().unwrap_or_default();
    let user_agents = home.join("Library/LaunchAgents");
    if !plist_path.starts_with(user_agents.to_str().unwrap_or("")) {
        return Err(AppError::Launchctl(
            "Cannot start/stop system agents or daemons. Only user agents (~/Library/LaunchAgents) can be managed."
                .to_string(),
        ));
    }
    Ok(())
}

#[tauri::command]
pub async fn list_jobs() -> Result<Vec<JobListEntry>, AppError> {
    let plist_files = plist_util::scan_plist_files();
    let loaded = launchctl::list_loaded().unwrap_or_default();

    let loaded_map: HashMap<String, &launchctl::LoadedService> =
        loaded.iter().map(|s| (s.label.clone(), s)).collect();

    let mut entries = Vec::new();
    for (path, source) in plist_files {
        let config = match plist_util::parse_plist(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let (status, pid, exit_code) = if let Some(svc) = loaded_map.get(&config.label) {
            let status = if svc.pid.is_some() {
                JobStatus::Running
            } else {
                JobStatus::Stopped
            };
            (status, svc.pid, svc.last_exit_code)
        } else {
            (JobStatus::Stopped, None, None)
        };

        entries.push(JobListEntry {
            label: config.label,
            pid,
            last_exit_code: exit_code,
            plist_path: path,
            source,
            status,
        });
    }

    entries.sort_by(|a, b| a.label.cmp(&b.label));
    Ok(entries)
}

#[tauri::command]
pub async fn get_job_detail(plist_path: String) -> Result<LaunchdJob, AppError> {
    if !std::path::Path::new(&plist_path).exists() {
        return Err(AppError::NotFound(plist_path));
    }

    let plist = plist_util::parse_plist(&plist_path)?;
    let loaded = launchctl::list_loaded().unwrap_or_default();

    let svc = loaded.iter().find(|s| s.label == plist.label);
    let (status, pid, exit_code) = match svc {
        Some(s) => {
            let status = if s.pid.is_some() {
                JobStatus::Running
            } else {
                JobStatus::Stopped
            };
            (status, s.pid, s.last_exit_code)
        }
        None => (JobStatus::Stopped, None, None),
    };

    let source = if plist_path.contains("/Library/LaunchDaemons") {
        crate::types::JobSource::SystemDaemon
    } else if plist_path.starts_with("/Library/LaunchAgents") {
        crate::types::JobSource::SystemAgent
    } else {
        crate::types::JobSource::UserAgent
    };

    Ok(LaunchdJob {
        label: plist.label.clone(),
        plist_path,
        source,
        status,
        pid,
        last_exit_code: exit_code,
        plist,
    })
}

#[tauri::command]
pub async fn start_job(plist_path: String) -> Result<(), AppError> {
    ensure_user_agent(&plist_path)?;
    // Unload first to avoid "already loaded" or stale state
    let _ = launchctl::bootout(&plist_path);
    launchctl::bootstrap(&plist_path)
}

#[tauri::command]
pub async fn stop_job(plist_path: String) -> Result<(), AppError> {
    ensure_user_agent(&plist_path)?;
    launchctl::bootout(&plist_path)
}

#[tauri::command]
pub async fn restart_job(plist_path: String) -> Result<(), AppError> {
    ensure_user_agent(&plist_path)?;
    let _ = launchctl::bootout(&plist_path);
    launchctl::bootstrap(&plist_path)
}

#[tauri::command]
pub async fn kickstart_job(label: String, plist_path: String) -> Result<(), AppError> {
    ensure_user_agent(&plist_path)?;
    // Ensure the service is loaded before kickstarting
    let loaded = launchctl::list_loaded().unwrap_or_default();
    let is_loaded = loaded.iter().any(|s| s.label == label);
    if !is_loaded {
        launchctl::bootstrap(&plist_path)?;
    }
    launchctl::kickstart(&label)
}

#[tauri::command]
pub async fn enable_job(label: String) -> Result<(), AppError> {
    launchctl::enable(&label)
}

#[tauri::command]
pub async fn disable_job(label: String) -> Result<(), AppError> {
    launchctl::disable(&label)
}

#[tauri::command]
pub async fn save_job(plist_path: String, config: PlistConfig) -> Result<(), AppError> {
    plist_util::write_plist(&plist_path, &config)
}

#[tauri::command]
pub async fn create_job(label: String, config: PlistConfig) -> Result<String, AppError> {
    let agents_dir = plist_util::get_user_agents_dir();
    if !agents_dir.exists() {
        std::fs::create_dir_all(&agents_dir)?;
    }
    let path = agents_dir.join(format!("{label}.plist"));
    let path_str = path
        .to_str()
        .ok_or_else(|| AppError::Plist("invalid path".to_string()))?
        .to_string();
    plist_util::write_plist(&path_str, &config)?;
    Ok(path_str)
}

#[tauri::command]
pub async fn save_raw_plist(plist_path: String, xml: String) -> Result<(), AppError> {
    plist_util::write_raw_plist(&plist_path, &xml)
}

#[tauri::command]
pub async fn delete_job(plist_path: String, label: String) -> Result<(), AppError> {
    let _ = launchctl::bootout(&plist_path);
    let _ = launchctl::disable(&label);
    if std::path::Path::new(&plist_path).exists() {
        std::fs::remove_file(&plist_path)?;
    }
    Ok(())
}

#[derive(serde::Serialize)]
pub struct LogFileResult {
    content: String,
    modified_at: Option<String>,
}

#[tauri::command]
pub async fn read_log_file(
    path: String,
    tail_lines: Option<usize>,
) -> Result<LogFileResult, AppError> {
    if !std::path::Path::new(&path).exists() {
        return Err(AppError::NotFound(format!("log file not found: {path}")));
    }

    let metadata = std::fs::metadata(&path)?;
    let modified_at = metadata
        .modified()
        .ok()
        .and_then(|t| {
            let duration = t
                .duration_since(std::time::UNIX_EPOCH)
                .ok()?;
            Some(duration.as_secs())
        })
        .map(|secs| {
            // ISO 8601 timestamp in UTC (frontend will format to local)
            let secs_i64 = secs as i64;
            format!(
                "{}",
                secs_i64 * 1000 // milliseconds for JS Date
            )
        });

    let content = std::fs::read_to_string(&path)?;
    let content = match tail_lines {
        Some(n) => {
            let lines: Vec<&str> = content.lines().collect();
            let start = lines.len().saturating_sub(n);
            lines[start..].join("\n")
        }
        None => content,
    };

    Ok(LogFileResult {
        content,
        modified_at,
    })
}

#[tauri::command]
pub async fn open_log_in_editor(path: String) -> Result<(), AppError> {
    std::process::Command::new("open")
        .arg("-t")
        .arg(&path)
        .spawn()?;
    Ok(())
}

#[tauri::command]
pub async fn reveal_in_finder(path: String) -> Result<(), AppError> {
    std::process::Command::new("open")
        .arg("-R")
        .arg(&path)
        .spawn()?;
    Ok(())
}
