import 'package:flutter/foundation.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// Reads the installed package's native metadata; never invents a build version.
class BuildInfoController extends ChangeNotifier {
  BuildInfoController({Future<String> Function()? reader})
    : _reader = reader ?? _nativeVersion;
  final Future<String> Function() _reader;
  static Future<String> _nativeVersion() async {
    final info = await PackageInfo.fromPlatform();
    if (info.version.trim().isEmpty || info.buildNumber.trim().isEmpty) {
      throw const FormatException('Missing package metadata');
    }
    return '${info.version} (${info.buildNumber})';
  }

  String? version, error;
  bool loading = false, _disposed = false;
  int _generation = 0;
  Future<void> refresh() async {
    if (_disposed || loading) return;
    final generation = ++_generation;
    loading = true;
    notifyListeners();
    try {
      final value = await _reader();
      if (_disposed || generation != _generation) return;
      version = value;
      error = null;
    } catch (_) {
      if (_disposed || generation != _generation) return;
      version = null;
      error = '未获取构建版本';
    } finally {
      if (!_disposed && generation == _generation) {
        loading = false;
        notifyListeners();
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    ++_generation;
    super.dispose();
  }
}
