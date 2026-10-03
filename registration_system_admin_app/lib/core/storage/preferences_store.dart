import 'package:shared_preferences/shared_preferences.dart';

abstract interface class PreferencesStore {
  /// Null means the user has not selected a theme yet.
  Future<bool?> readTheme();
  Future<void> writeTheme(bool dark);
}

/// Stores only non-sensitive preferences, using uncached reads.
class PlatformPreferencesStore implements PreferencesStore {
  PlatformPreferencesStore({SharedPreferencesAsync? preferences})
    : _preferences = preferences ?? SharedPreferencesAsync();

  static const _themeKey = 'admin_app.theme.dark';
  final SharedPreferencesAsync _preferences;

  @override
  Future<bool?> readTheme() => _preferences.getBool(_themeKey);

  @override
  Future<void> writeTheme(bool dark) => _preferences.setBool(_themeKey, dark);
}
