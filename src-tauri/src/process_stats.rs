use std::sync::{LazyLock, Mutex};
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System};

static SYSTEM: LazyLock<Mutex<System>> = LazyLock::new(|| {
    Mutex::new(System::new_with_specifics(
        RefreshKind::nothing()
            .with_processes(ProcessRefreshKind::nothing().with_cpu().with_memory()),
    ))
});

/// Returns (cpu_percent, memory_bytes) for the given PID, or None if the process does not exist.
pub fn get_process_stats(pid: u32) -> Option<(f32, u64)> {
    let mut sys = SYSTEM.lock().ok()?;
    let sysinfo_pid = Pid::from_u32(pid);

    sys.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[sysinfo_pid]),
        true,
        ProcessRefreshKind::nothing().with_cpu().with_memory(),
    );

    sys.process(sysinfo_pid)
        .map(|p| (p.cpu_usage(), p.memory()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_stats_for_self() {
        let pid = std::process::id();
        // First call may return 0% CPU (needs two data points), but should succeed
        let result = get_process_stats(pid);
        assert!(result.is_some(), "should get stats for own process");
        let (cpu, mem) = result.unwrap();
        assert!(cpu >= 0.0, "cpu should be non-negative");
        assert!(mem > 0, "memory should be positive for a running process");
    }

    #[test]
    fn test_get_stats_for_nonexistent_pid() {
        // Very high PIDs should not exist
        let result = get_process_stats(4_000_000);
        assert!(result.is_none(), "should return None for nonexistent PID");
    }
}
