import 'package:flutter/foundation.dart';
import '../core/storage/preferences_store.dart';

/// Theme persistence is independent of protected-session state.
class ThemeController extends ChangeNotifier {
  ThemeController({required PreferencesStore preferences})
    : _preferences = preferences;
  final PreferencesStore _preferences;
  bool _dark = true;
  bool get dark => _dark;
  String? _error;
  String? get error => _error;
  int _generation = 0;
  bool _disposed = false;
  Future<void> _tail = Future<void>.value();

  Future<void> restore() async {
    final generation = ++_generation;
    try {
      final saved = await _preferences.readTheme();
      if (_disposed || generation != _generation) return;
      _dark = saved ?? true;
      _error = null;
    } catch (_) {
      if (_disposed || generation != _generation) return;
      _error = '读取主题偏好失败，请重试';
    }
    notifyListeners();
  }

  Future<void> setDark(bool dark) {
    final generation = ++_generation;
    final write = _tail.then((_) async {
      try {
        await _preferences.writeTheme(dark);
        if (_disposed || generation != _generation) return;
        _dark = dark;
        _error = null;
      } catch (_) {
        if (_disposed || generation != _generation) return;
        _error = '保存主题偏好失败，请重试';
      }
      notifyListeners();
    });
    _tail = write;
    return write;
  }

  @override
  void dispose() {
    _disposed = true;
    ++_generation;
    super.dispose();
  }
}
