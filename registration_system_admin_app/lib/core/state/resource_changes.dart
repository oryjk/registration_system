import 'dart:async';

enum ResourceKind { matches, teams, members }

class ResourceChange {
  const ResourceChange(this.kind, {this.teamId});

  final ResourceKind kind;
  final int? teamId;
}

/// App-owned notifications for views that depend on changed resources.
class ResourceChanges {
  final _controller = StreamController<ResourceChange>.broadcast();
  bool _disposed = false;

  Stream<ResourceChange> get stream => _controller.stream;

  void emit(ResourceKind kind, {int? teamId}) {
    if (_disposed) throw StateError('Resource changes is disposed');
    _controller.add(ResourceChange(kind, teamId: teamId));
  }

  void dispose() {
    if (_disposed) return;
    _disposed = true;
    unawaited(_controller.close());
  }
}
