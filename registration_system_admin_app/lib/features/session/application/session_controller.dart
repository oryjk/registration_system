import 'package:flutter/foundation.dart';
import '../../../core/network/api_error.dart';
import '../../../core/network/session_access.dart';
import '../../../core/storage/secure_store.dart';
import '../domain/admin_session.dart';
import '../domain/session_repository.dart';

enum SessionPhase { bootstrapping, signedOut, signedIn, recoverableError }

/// Only signedIn permits protected routes. Tokens used during restore do not.
class SessionState {
  const SessionState(
    this.phase, {
    this.admin,
    this.error,
    this.submitting = false,
  });
  final SessionPhase phase;
  final AdminUser? admin;
  final Object? error;
  final bool submitting;
}

class SessionStorageError implements Exception {
  const SessionStorageError(this.operation);
  final String operation;
  @override
  String toString() => '安全存储$operation失败，请重试';
}

class SessionController extends ChangeNotifier implements SessionAccess {
  SessionController({
    required SessionRepository repository,
    required SecureStore storage,
    required Uri environment,
  }) : _repository = repository,
       _storage = storage,
       tokenKey =
           'admin_app.session.${Uri.encodeComponent(normalizeEnvironment(environment))}.token';

  /// Shared environment identity for session and future pending-fund namespaces.
  static String normalizeEnvironment(Uri value) {
    if (!['http', 'https'].contains(value.scheme) ||
        value.host.isEmpty ||
        value.userInfo.isNotEmpty ||
        value.hasQuery ||
        value.hasFragment) {
      throw ArgumentError('API environment must be an HTTP(S) base URL');
    }
    final path = value.normalizePath().path.replaceFirst(RegExp(r'/+$'), '');
    return Uri(
      scheme: value.scheme.toLowerCase(),
      host: value.host.toLowerCase(),
      port: value.hasPort ? value.port : null,
      path: path,
    ).toString();
  }

  final SessionRepository _repository;
  final SecureStore _storage;
  final String tokenKey;
  SessionState _state = const SessionState(SessionPhase.bootstrapping);
  SessionState get state => _state;
  String? _token;
  @override
  String? get token => _token;
  int _generation = 0;
  @override
  int get generation => _generation;
  bool _busy = false;
  bool _cleanupRequired = false;
  bool _disposed = false;
  Future<void> _storageTail = Future<void>.value();
  Future<void>? _clearing;

  void _publish(SessionState next) {
    if (_disposed) return;
    _state = next;
    notifyListeners();
  }

  bool _current(int operation) => !_disposed && operation == _generation;

  /// Serializes secure I/O so a late write cannot resurrect a logged-out token.
  Future<T> _store<T>(Future<T> Function() action) {
    final next = _storageTail.then((_) => action());
    _storageTail = next.then<void>(
      (_) {},
      onError: (Object _, StackTrace _) {},
    );
    return next;
  }

  Future<void> restore() async {
    if (_disposed || _busy || _cleanupRequired || _clearing != null) return;
    _busy = true;
    final operation = ++_generation;
    _token = null;
    _publish(const SessionState(SessionPhase.bootstrapping));
    try {
      String? saved;
      try {
        saved = await _store(() => _storage.read(tokenKey));
      } catch (_) {
        throw const SessionStorageError('读取');
      }
      if (!_current(operation)) return;
      if (saved == null) {
        _publish(const SessionState(SessionPhase.signedOut));
        return;
      }
      if (saved.trim().isEmpty) {
        await logout();
        return;
      }
      _token = saved;
      final admin = await _repository.current();
      if (_current(operation)) {
        _publish(SessionState(SessionPhase.signedIn, admin: admin));
      }
    } catch (error) {
      if (!_current(operation)) return;
      if (error is ApiError && error.kind == ApiErrorKind.unauthorized) {
        await logout();
      } else {
        _publish(SessionState(SessionPhase.recoverableError, error: error));
      }
    } finally {
      if (_current(operation)) _busy = false;
    }
  }

  Future<void> login(String username, String password) async {
    if (_disposed ||
        _busy ||
        _cleanupRequired ||
        _clearing != null ||
        _state.phase != SessionPhase.signedOut) {
      return;
    }
    _busy = true;
    final operation = ++_generation;
    _publish(const SessionState(SessionPhase.signedOut, submitting: true));
    try {
      final result = await _repository.login(username, password);
      if (!_current(operation)) return;
      if (result.accessToken.trim().isEmpty) {
        throw const ApiError(
          message: '登录响应缺少有效凭证',
          kind: ApiErrorKind.protocol,
        );
      }
      try {
        await _store(() => _storage.write(tokenKey, result.accessToken));
      } catch (_) {
        if (!_current(operation)) return;
        _cleanupRequired =
            true; // A failed platform write may have partially persisted.
        throw const SessionStorageError('写入');
      }
      if (!_current(operation)) return;
      _token = result.accessToken;
      _publish(SessionState(SessionPhase.signedIn, admin: result.admin));
    } catch (error) {
      if (_current(operation)) {
        _publish(
          SessionState(
            _cleanupRequired
                ? SessionPhase.recoverableError
                : SessionPhase.signedOut,
            error: error,
          ),
        );
      }
    } finally {
      if (_current(operation)) _busy = false;
    }
  }

  Future<void> logout() {
    if (_disposed) return Future<void>.value();
    final existing = _clearing;
    if (existing != null) return existing;
    final operation = ++_generation;
    _token = null;
    _busy = false;
    _cleanupRequired = true;
    // Lock immediately, before any platform storage await.
    _publish(const SessionState(SessionPhase.bootstrapping));
    final clearing = _clear(operation);
    _clearing = clearing;
    return clearing;
  }

  Future<void> _clear(int operation) async {
    try {
      await _store(() => _storage.delete(tokenKey));
      if (!_current(operation)) return;
      _cleanupRequired = false;
      _publish(const SessionState(SessionPhase.signedOut));
    } catch (_) {
      if (_current(operation)) {
        _publish(
          const SessionState(
            SessionPhase.recoverableError,
            error: SessionStorageError('删除'),
          ),
        );
      }
    } finally {
      _clearing = null;
    }
  }

  Future<void> retry() => _cleanupRequired ? logout() : restore();

  @override
  Future<void> unauthorized(int requestGeneration) {
    if (!_current(requestGeneration) || _token == null) {
      return Future<void>.value();
    }
    return logout();
  }

  @override
  void dispose() {
    _disposed = true;
    ++_generation;
    _token = null;
    super.dispose();
  }
}
