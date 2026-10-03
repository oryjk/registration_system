import 'dart:async';
import 'package:http/http.dart' as http;
import 'build_info_controller.dart';
import '../core/network/api_client.dart';
import '../core/network/session_access.dart';
import '../core/state/resource_changes.dart';
import '../core/storage/preferences_store.dart';
import '../core/storage/secure_store.dart';
import '../design_system/theme_controller.dart';
import '../features/session/application/session_controller.dart';
import '../features/session/data/http_session_repository.dart';
import '../features/session/domain/session_repository.dart';
import '../features/matches/data/http_match_repository.dart';
import '../features/matches/domain/match_repository.dart';
import '../features/teams/data/http_team_repository.dart';
import '../features/teams/domain/team_repository.dart';
import '../features/members/data/http_member_repository.dart';
import '../features/members/domain/member_repository.dart';
import '../features/team_fund/data/http_fund_repository.dart';
import '../features/team_fund/data/secure_pending_fund_store.dart';
import '../features/team_fund/domain/fund_repository.dart';

/// App-lifetime storage boundary. Keep this identity across environment swaps:
/// pending serialization must survive disposal of old HTTP/session dependencies.
class AppStores {
  AppStores._({required this.storage, required this.preferences})
    : pendingFunds = SecurePendingFundStore(storage);
  factory AppStores({SecureStore? storage, PreferencesStore? preferences}) =>
      AppStores._(
        storage: storage ?? PlatformSecureStore(),
        preferences: preferences ?? PlatformPreferencesStore(),
      );
  final SecureStore storage;
  final PreferencesStore preferences;
  final PendingFundStore pendingFunds;
}

/// Owns the real HTTP repositories and one shared secure pending-fund store.
/// Owns its transport/controllers. Await initialize before selecting app routes.
class AppDependencies {
  AppDependencies._({
    required this.api,
    required this.stores,
    required this.buildInfo,
    required this.baseUrl,
    required this.sessionRepository,
    required this.session,
    required this.theme,
    required this.storage,
    required this.preferences,
    required this.changes,
  }) : matches = HttpMatchRepository(api),
       teams = HttpTeamRepository(api),
       members = HttpMemberRepository(api),
       funds = HttpFundRepository(api),
       pendingFunds = stores.pendingFunds;

  factory AppDependencies({
    required Uri baseUrl,
    http.Client? transport,
    SecureStore? storage,
    PreferencesStore? preferences,
    AppStores? stores,
    Future<String> Function()? buildVersionReader,
  }) {
    if (stores != null && (storage != null || preferences != null)) {
      throw ArgumentError(
        'Pass stores or individual storage/preferences, not both',
      );
    }
    final shared =
        stores ?? AppStores(storage: storage, preferences: preferences);
    final secure = shared.storage;
    final prefs = shared.preferences;
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
      stores: shared,
      buildInfo: BuildInfoController(reader: buildVersionReader),
      baseUrl: baseUrl,
      sessionRepository: repository,
      session: session,
      theme: ThemeController(preferences: prefs),
      storage: secure,
      preferences: prefs,
      changes: ResourceChanges(),
    );
  }

  final AppStores stores;
  final BuildInfoController buildInfo;
  final Uri baseUrl;
  final ApiClient api;
  final MatchRepository matches;
  final TeamRepository teams;
  final MemberRepository members;
  final FundRepository funds;
  final PendingFundStore pendingFunds;
  final SessionRepository sessionRepository;
  final SessionController session;
  final ThemeController theme;
  final SecureStore storage;
  final PreferencesStore preferences;
  final ResourceChanges changes;

  /// Default environment recreation always retains the pending-store queue.
  AppDependencies forEnvironment(
    Uri environment, {
    http.Client? transport,
    Future<String> Function()? buildVersionReader,
  }) => AppDependencies(
    baseUrl: environment,
    transport: transport,
    stores: stores,
    buildVersionReader: buildVersionReader,
  );

  Future<void> initialize() async {
    unawaited(buildInfo.refresh());
    await theme.restore();
    await session.restore();
  }

  bool _disposed = false;
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    buildInfo.dispose();
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
