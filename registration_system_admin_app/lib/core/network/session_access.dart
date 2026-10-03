/// Session ownership stays outside the HTTP transport.
abstract interface class SessionAccess {
  String? get token;
  int get generation;
  Future<void> unauthorized(int requestGeneration);
}
