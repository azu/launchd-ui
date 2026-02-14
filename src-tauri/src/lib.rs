mod commands;
mod error;
mod launchctl;
mod plist_util;
mod types;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::list_jobs,
            commands::get_job_detail,
            commands::start_job,
            commands::stop_job,
            commands::restart_job,
            commands::kickstart_job,
            commands::enable_job,
            commands::disable_job,
            commands::save_job,
            commands::save_raw_plist,
            commands::create_job,
            commands::delete_job,
            commands::read_log_file,
            commands::open_log_in_editor,
            commands::reveal_in_finder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
