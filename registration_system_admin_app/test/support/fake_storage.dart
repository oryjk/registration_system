import 'package:registration_system_admin_app/core/storage/preferences_store.dart';
import 'package:registration_system_admin_app/core/storage/secure_store.dart';

class FakeSecureStore implements SecureStore {
  FakeSecureStore({Map<String, String>? initialValues})
    : values = {...?initialValues};

  final Map<String, String> values;
  Object? readError;
  Object? writeError;
  Object? deleteError;

  @override
  Future<String?> read(String key) async {
    if (readError != null) throw readError!;
    return values[key];
  }

  @override
  Future<void> write(String key, String value) async {
    if (writeError != null) throw writeError!;
    values[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    if (deleteError != null) throw deleteError!;
    values.remove(key);
  }
}

class FakePreferencesStore implements PreferencesStore {
  FakePreferencesStore({this.dark});

  bool? dark;
  Object? readError;
  Object? writeError;

  @override
  Future<bool?> readTheme() async {
    if (readError != null) throw readError!;
    return dark;
  }

  @override
  Future<void> writeTheme(bool value) async {
    if (writeError != null) throw writeError!;
    dark = value;
  }
}
