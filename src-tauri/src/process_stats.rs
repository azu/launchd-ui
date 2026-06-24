use std::sync::{LazyLock, Mutex};
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System};

static SYSTEM: LazyLock<Mutex<System>> = LazyLock::new(|| {
    Mutex::new(System::new_with_specifics(
        RefreshKind::nothing()
            .with_processes(ProcessRefreshKind::nothing().with_cpu().with_memory()),
    ))
});

pub fn get_process_stats(pid: u32) -> Option<(f32, u64)> {
    let mut system = SYSTEM.lock().ok()?;
    let pid = Pid::from_u32(pid);

    system.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[pid]),
        true,
        ProcessRefreshKind::nothing().with_cpu().with_memory(),
    );

    system
        .process(pid)
        .map(|process| (process.cpu_usage(), process.memory()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_stats_for_current_process() {
        let stats = get_process_stats(std::process::id());

        assert!(stats.is_some());
        let (cpu_percent, memory_bytes) = stats.unwrap();
        assert!(cpu_percent >= 0.0);
        assert!(memory_bytes > 0);
    }

    #[test]
    fn returns_none_for_missing_process() {
        assert!(get_process_stats(4_000_000).is_none());
    }
}
