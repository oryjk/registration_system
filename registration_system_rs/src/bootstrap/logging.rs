use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

pub fn init_tracing() -> anyhow::Result<()> {
    // 创建日志目录
    let log_dir = std::path::Path::new("logs");
    if !log_dir.exists() {
        std::fs::create_dir_all(log_dir).map_err(|e| anyhow::anyhow!("创建日志目录失败: {e}"))?;
    }

    // 创建按大小轮转的日志 appender
    // 当前文件: app.log，轮转后: app.YYYY-MM-DD-HH-MM-SS.log
    let file_appender = RollingFileAppender::new(
        log_dir.to_path_buf(),
        "app".to_string(),
        "log".to_string(),
        10 * 1024 * 1024, // 10MB per file
        100,              // 保留最近 100 个历史文件
    );

    let (non_blocking_file, guard) = tracing_appender::non_blocking(file_appender);
    // 防止 guard 被 drop（否则文件写入会停止）
    std::mem::forget(guard);

    let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| "registration_system_backend=info,tower_http=info,sqlx=warn".into());

    tracing_subscriber::registry()
        .with(env_filter)
        .with(
            // 文件日志层：无 ANSI 颜色，RFC 3339 时间戳
            tracing_subscriber::fmt::layer()
                .with_timer(tracing_subscriber::fmt::time::LocalTime::rfc_3339())
                .with_target(true)
                .with_writer(non_blocking_file)
                .with_ansi(false),
        )
        .with(
            // 控制台日志层
            tracing_subscriber::fmt::layer()
                .with_timer(tracing_subscriber::fmt::time::LocalTime::rfc_3339())
                .with_target(true)
                .with_writer(std::io::stdout),
        )
        .try_init()
        .map_err(|e| anyhow::anyhow!("初始化日志订阅器失败: {e}"))?;

    tracing::info!("日志已初始化（logs/app.log，10MB 滚动轮转，最多保留 100 个历史文件）");
    Ok(())
}

/// 自定义按大小滚动轮转的日志 Appender
struct RollingFileAppender {
    log_dir: std::path::PathBuf,
    prefix: String,
    suffix: String,
    max_size: u64,
    max_files: usize,
    current_file: std::fs::File,
    current_size: u64,
}

impl RollingFileAppender {
    fn new(
        log_dir: std::path::PathBuf,
        prefix: String,
        suffix: String,
        max_size: u64,
        max_files: usize,
    ) -> Self {
        let current_path = log_dir.join(format!("{}.{}", prefix, suffix));
        let current_file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&current_path)
            .expect("打开日志文件失败");

        let current_size = current_file.metadata().map(|m| m.len()).unwrap_or(0);

        Self {
            log_dir,
            prefix,
            suffix,
            max_size,
            max_files,
            current_file,
            current_size,
        }
    }

    fn rotate(&mut self) {
        // 轮转文件名: app.YYYY-MM-DD-HH-MM-SS.log
        let timestamp = chrono::Local::now().format("%Y-%m-%d-%H-%M-%S").to_string();
        let rotated_name = format!("{}.{}.{}", self.prefix, timestamp, self.suffix);
        let rotated_path = self.log_dir.join(&rotated_name);

        // 关闭当前文件句柄
        drop(std::mem::replace(
            &mut self.current_file,
            std::fs::File::open("/dev/null").unwrap(),
        ));

        // 重命名当前文件
        let current_path = self
            .log_dir
            .join(format!("{}.{}", self.prefix, self.suffix));
        if let Err(e) = std::fs::rename(&current_path, &rotated_path) {
            eprintln!("日志轮转失败: {e}");
            return;
        }

        // 创建新的当前文件
        self.current_file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&current_path)
            .expect("创建新日志文件失败");
        self.current_size = 0;

        self.cleanup_old_files();
    }

    fn cleanup_old_files(&self) {
        let Ok(entries) = std::fs::read_dir(&self.log_dir) else {
            return;
        };

        let mut files: Vec<(String, std::time::SystemTime)> = entries
            .filter_map(|e| e.ok())
            .filter(|e| {
                let name = e.file_name().to_string_lossy().to_string();
                name.starts_with(&format!("{}.", self.prefix))
                    && name.ends_with(&format!(".{}", self.suffix))
                    && name != format!("{}.{}", self.prefix, self.suffix)
            })
            .filter_map(|e| {
                let name = e.file_name().to_string_lossy().to_string();
                let time = e.metadata().ok()?.modified().ok()?;
                Some((name, time))
            })
            .collect();

        // 按修改时间排序（新→旧），删除超出限制的旧文件
        files.sort_by(|a, b| b.1.cmp(&a.1));
        for (name, _) in files.into_iter().skip(self.max_files) {
            let _ = std::fs::remove_file(self.log_dir.join(name));
        }
    }
}

impl std::io::Write for RollingFileAppender {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        if self.current_size >= self.max_size {
            self.rotate();
        }
        let written = self.current_file.write(buf)?;
        self.current_size += written as u64;
        Ok(written)
    }

    fn flush(&mut self) -> std::io::Result<()> {
        self.current_file.flush()
    }
}
