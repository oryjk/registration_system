import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/core/network/api_error.dart';
import 'package:registration_system_admin_app/core/storage/secure_store.dart';
import 'package:registration_system_admin_app/features/session/application/session_controller.dart';
import 'package:registration_system_admin_app/features/session/domain/admin_session.dart';
import '../support/fake_storage.dart';
import '../support/fake_session_repository.dart';

class SlowStore extends FakeSecureStore {
  Completer<void>? writing;
  Completer<void>? deleting;
  int deletes = 0;
  @override
  Future<void> write(String key, String value) async {
    if (writing != null) await writing!.future;
    await super.write(key, value);
  }

  @override
  Future<void> delete(String key) async {
    deletes++;
    if (deleting != null) await deleting!.future;
    await super.delete(key);
  }
}

void main() {
  late Repository repo;
  late FakeSecureStore store;
  late SessionController session;
  SessionController create(
    SecureStore storage, {
    String env = 'https://example.test/regist-v3',
  }) => SessionController(
    repository: repo,
    storage: storage,
    environment: Uri.parse(env),
  );
  setUp(() async {
    repo = Repository();
    store = FakeSecureStore();
    session = create(store);
    await session.restore();
  });
  test('valid saved token restores authenticated user', () async {
    store.values[session.tokenKey] = 'saved';
    await session.restore();
    expect(session.state.phase, SessionPhase.signedIn);
    expect(session.token, 'saved');
    expect(session.state.admin?.id, 7);
  });
  test('401 removes saved token and locks routes', () async {
    store.values[session.tokenKey] = 'saved';
    repo.error = const ApiError(
      message: 'expired',
      kind: ApiErrorKind.unauthorized,
    );
    await session.restore();
    expect(session.state.phase, SessionPhase.signedOut);
    expect(store.values, isEmpty);
    expect(session.token, isNull);
  });
  test(
    'network failure preserves saved token without protected access and retry restores',
    () async {
      store.values[session.tokenKey] = 'saved';
      repo.error = const ApiError(
        message: 'offline',
        kind: ApiErrorKind.network,
      );
      await session.restore();
      expect(session.state.phase, SessionPhase.recoverableError);
      expect(store.values[session.tokenKey], 'saved');
      repo.error = null;
      await session.retry();
      expect(session.state.phase, SessionPhase.signedIn);
    },
  );
  test('read failure is explicit and retryable', () async {
    store.readError = StateError('storage');
    await session.restore();
    expect(session.state.phase, SessionPhase.recoverableError);
    expect(session.state.error, isA<SessionStorageError>());
    store.readError = null;
    await session.retry();
    expect(session.state.phase, SessionPhase.signedOut);
  });
  test(
    'failed token write never publishes success and requires cleanup',
    () async {
      store.writeError = StateError('storage');
      await session.login('operator', 'password');
      expect(session.state.phase, SessionPhase.recoverableError);
      expect(session.state.error, isA<SessionStorageError>());
      expect(session.token, isNull);
      store.writeError = null;
      await session.retry();
      expect(session.state.phase, SessionPhase.signedOut);
    },
  );
  test(
    'delete failure locks protected UI and new login until successful retry',
    () async {
      await session.login('operator', 'password');
      store.deleteError = StateError('storage');
      final exit = session.logout();
      expect(session.token, isNull);
      expect(session.state.phase, isNot(SessionPhase.signedIn));
      await exit;
      await session.login('other', 'password');
      expect(repo.logins, 1);
      expect(session.state.phase, SessionPhase.recoverableError);
      store.deleteError = null;
      await session.retry();
      await session.login('other', 'password');
      expect(repo.logins, 2);
    },
  );
  test(
    'concurrent unauthorized cleans only once and stale callbacks preserve new session',
    () async {
      final slow = SlowStore();
      session = create(slow);
      await session.restore();
      await session.login('operator', 'password');
      final old = session.generation;
      slow.deleting = Completer<void>();
      final first = session.unauthorized(old);
      final second = session.unauthorized(old);
      await Future<void>.delayed(Duration.zero);
      expect(slow.deletes, 1);
      slow.deleting!.complete();
      await Future.wait([first, second]);
      await session.login('new', 'password');
      await session.unauthorized(old);
      expect(session.state.phase, SessionPhase.signedIn);
    },
  );
  test(
    'logout invalidates an in-flight login before it can save token',
    () async {
      repo.loginPending = Completer<AdminSession>();
      final login = session.login('operator', 'password');
      await session.logout();
      repo.loginPending!.complete(
        AdminSession(accessToken: 'late', admin: user),
      );
      await login;
      expect(session.state.phase, SessionPhase.signedOut);
      expect(store.values, isEmpty);
    },
  );
  test('logout waits for pending token write then deletes it', () async {
    final slow = SlowStore()..writing = Completer<void>();
    session = create(slow);
    await session.restore();
    final login = session.login('operator', 'password');
    await Future<void>.delayed(Duration.zero);
    final logout = session.logout();
    expect(session.token, isNull);
    await session.login('other', 'password');
    expect(repo.logins, 1);
    slow.writing!.complete();
    await Future.wait([login, logout]);
    expect(slow.values, isEmpty);
    expect(session.state.phase, SessionPhase.signedOut);
  });
  test('logout invalidates in-flight restore response', () async {
    store.values[session.tokenKey] = 'saved';
    repo.currentPending = Completer<AdminUser>();
    final restore = session.restore();
    await Future<void>.delayed(Duration.zero);
    await session.logout();
    repo.currentPending!.complete(user);
    await restore;
    expect(session.state.phase, SessionPhase.signedOut);
  });
  test(
    'environment token keys normalize and logout preserves fund records',
    () async {
      final equivalent = create(
        store,
        env: 'https://EXAMPLE.test:443/regist-v3/',
      );
      expect(equivalent.tokenKey, session.tokenKey);
      final other = create(store, env: 'https://other.test/regist-v3');
      expect(other.tokenKey, isNot(session.tokenKey));
      store.values['fund.pending.7'] = 'payload';
      await session.login('operator', 'password');
      await session.logout();
      expect(store.values, {'fund.pending.7': 'payload'});
    },
  );
}
