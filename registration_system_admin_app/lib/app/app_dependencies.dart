import 'package:http/http.dart' as http;
import '../core/network/api_client.dart';
import '../core/network/session_access.dart';
import '../core/state/resource_changes.dart';
import '../core/storage/preferences_store.dart';
import '../core/storage/secure_store.dart';
import '../design_system/theme_controller.dart';
import '../features/session/application/session_controller.dart';
import '../features/session/data/http_session_repository.dart';
import '../features/session/domain/session_repository.dart';

/// Foundation/session composition only; feature repositories join in Task 9.
/// Owns its transport/controllers. Await initialize before selecting app routes.
class AppDependencies {
  AppDependencies._({
    required this.api,
    required this.sessionRepository,
    required this.session,
    required this.theme,
    required this.storage,
    required this.preferences,
    required this.changes,
  });

  factory AppDependencies({
    required Uri baseUrl,
    http.Client? transport,
    SecureStore? storage,
    PreferencesStore? preferences,
  }) {
    final secure = storage ?? PlatformSecureStore();
    final prefs = preferences ?? PlatformPreferencesStore();
    final bridge = _SessionBridge();
    final api = ApiClient(
      baseUrl: baseUrl,
      transport: transport ?? http.Client(),
      session: bridge,
    );
    final repository = HttpSessionRepository(client: api);
    final session = SessionController(
      repository: repository,
      storage: secure,
      environment: baseUrl,
    );
    bridge.session = session;
    return AppDependencies._(
      api: api,
      sessionRepository: repository,
      session: session,
      theme: ThemeController(preferences: prefs),
      storage: secure,
      preferences: prefs,
      changes: ResourceChanges(),
    );
  }

  final ApiClient api;
  final SessionRepository sessionRepository;
  final SessionController session;
  final ThemeController theme;
  final SecureStore storage;
  final PreferencesStore preferences;
  final ResourceChanges changes;
  Future<void> initialize() async {
    await theme.restore();
    await session.restore();
  }

  void dispose() {
    api.close();
    session.dispose();
    theme.dispose();
    changes.dispose();
  }
}

/// Resolves the constructor cycle locally; never published as a global store.
class _SessionBridge implements SessionAccess {
  late final SessionController session;
  @override
  String? get token => session.token;
  @override
  int get generation => session.generation;
  @override
  Future<void> unauthorized(int requestGeneration) =>
      session.unauthorized(requestGeneration);
}
