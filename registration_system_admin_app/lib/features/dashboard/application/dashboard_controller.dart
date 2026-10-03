import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../../core/state/async_state.dart';
import '../../../core/state/resource_changes.dart';
import '../../matches/domain/match_repository.dart';

/// Real recent-match reads and a separate reachability check, without totals.
class DashboardController extends ChangeNotifier {
  DashboardController({
    required MatchRepository matches,
    required Future<void> Function() health,
    required ResourceChanges changes,
  }) : _matches = matches,
       _health = health {
    _subscription = changes.stream.listen((event) {
      if (event.kind == ResourceKind.matches) unawaited(refresh());
    });
  }
  final MatchRepository _matches;
  final Future<void> Function() _health;
  late final StreamSubscription<ResourceChange> _subscription;
  AsyncState<MatchPage> state = const AsyncState();
  Object? healthError;
  bool healthy = false;
  int _generation = 0;
  bool _disposed = false;
  Future<void> refresh() async {
    if (_disposed) return;
    final generation = ++_generation;
    state = state.startLoading();
    notifyListeners();
    await Future.wait([
      (() async {
        try {
          final page = await _matches.list(const MatchQuery(pageSize: 5));
          if (!_disposed && generation == _generation) {
            state = state.succeeded(page);
          }
        } catch (error) {
          if (!_disposed && generation == _generation) {
            state = state.failed(error);
          }
        }
      })(),
      (() async {
        try {
          await _health();
          if (!_disposed && generation == _generation) {
            healthy = true;
            healthError = null;
          }
        } catch (error) {
          if (!_disposed && generation == _generation) {
            healthy = false;
            healthError = error;
          }
        }
      })(),
    ]);
    if (!_disposed && generation == _generation) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    ++_generation;
    unawaited(_subscription.cancel());
    super.dispose();
  }
}
