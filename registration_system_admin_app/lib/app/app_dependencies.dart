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

/// Owns the real HTTP repositories and one shared secure pending-fund store.
/// Owns its transport/controllers. Await initialize before selecting app routes.
class AppDependencies {
  AppDependencies._({
    required this.api,
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
       pendingFunds = SecurePendingFundStore(storage);

  factory AppDependencies({
    required Uri baseUrl,
    http.Client? transport,
    SecureStore? storage,
    PreferencesStore? preferences,
    Future<String> Function()? buildVersionReader,
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
