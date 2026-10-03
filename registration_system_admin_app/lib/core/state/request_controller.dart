/// Captured generations prevent stale or disposed requests from updating UI.
class RequestController {
  int _generation = 0;
  bool _disposed = false;

  int begin() {
    if (_disposed) throw StateError('Request controller is disposed');
    return ++_generation;
  }

  bool isCurrent(int generation) => !_disposed && generation == _generation;

  void invalidate() => _generation++;

  void dispose() {
    _disposed = true;
    invalidate();
  }
}
