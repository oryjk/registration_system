/// Canonical API environment identity shared by session and pending-fund keys.
String normalizeEnvironment(Uri value) {
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
