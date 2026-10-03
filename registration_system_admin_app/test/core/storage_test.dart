import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:registration_system_admin_app/core/storage/secure_store.dart';
import 'package:registration_system_admin_app/core/storage/preferences_store.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../support/fakes.dart';

class _PluginStorage extends FlutterSecureStorage {
  final values = <String, String>{};
  Object? failure;
  @override
  Future<String?> read({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    if (failure != null) throw failure!;
    return values[key];
  }

  @override
  Future<void> write({
    required String key,
    required String? value,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    if (failure != null) throw failure!;
    values[key] = value!;
  }

  @override
  Future<void> delete({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    if (failure != null) throw failure!;
    values.remove(key);
  }
}

class _PluginPreferences implements SharedPreferencesAsync {
  _PluginPreferences({this.failure});
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
  final values = <String, bool>{};
  final Object? failure;
  @override
  Future<bool?> getBool(String key) async {
    if (failure != null) throw failure!;
    return values[key];
  }

  @override
  Future<void> setBool(String key, bool value) async {
    if (failure != null) throw failure!;
    values[key] = value;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'platform secure adapter preserves read write delete contract',
    () async {
      final store = PlatformSecureStore(storage: _PluginStorage());
      expect(await store.read('token'), isNull);
      await store.write('token', 'fixture-token');
      expect(await store.read('token'), 'fixture-token');
      await store.delete('token');
      expect(await store.read('token'), isNull);
    },
  );
  test('platform secure adapter explicitly propagates every failure', () async {
    final failure = StateError('secure storage unavailable');
    final plugin = _PluginStorage()..failure = failure;
    final store = PlatformSecureStore(storage: plugin);
    await expectLater(store.read('token'), throwsA(same(failure)));
    await expectLater(
      store.write('token', 'fixture-token'),
      throwsA(same(failure)),
    );
    await expectLater(store.delete('token'), throwsA(same(failure)));
  });
  test(
    'theme preferences preserve unset and explicit dark or light choice',
    () async {
      final store = PlatformPreferencesStore(preferences: _PluginPreferences());
      expect(await store.readTheme(), isNull);
      await store.writeTheme(true);
      expect(await store.readTheme(), isTrue);
      await store.writeTheme(false);
      expect(await store.readTheme(), isFalse);
    },
  );
  test('preference failures are visible to the caller', () async {
    final failure = StateError('preference storage unavailable');
    final store = PlatformPreferencesStore(
      preferences: _PluginPreferences(failure: failure),
    );
    await expectLater(store.readTheme(), throwsA(same(failure)));
    await expectLater(store.writeTheme(true), throwsA(same(failure)));
  });
  test(
    'fake secure store failures never mutate previous account values',
    () async {
      final store = FakeSecureStore();
      await store.write('token', 'fixture-old-token');
      final failure = StateError('unavailable');
      store.writeError = failure;
      await expectLater(
        store.write('token', 'fixture-new-token'),
        throwsA(same(failure)),
      );
      expect(await store.read('token'), 'fixture-old-token');
      store.deleteError = failure;
      await expectLater(store.delete('token'), throwsA(same(failure)));
      expect(await store.read('token'), 'fixture-old-token');
      store.readError = failure;
      await expectLater(store.read('token'), throwsA(same(failure)));
    },
  );
}
