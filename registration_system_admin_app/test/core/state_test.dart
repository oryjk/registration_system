import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/core/state/async_state.dart';
import 'package:registration_system_admin_app/core/state/request_controller.dart';
import 'package:registration_system_admin_app/core/state/resource_changes.dart';

void main() {
  test('refreshing and refresh failure retain previously loaded data', () {
    final initial = AsyncState<List<int>>(data: [1]);
    final refreshing = initial.startLoading();
    expect(refreshing.data, [1]);
    expect(refreshing.refreshing, isTrue);
    expect(refreshing.loading, isFalse);
    final failure = refreshing.failed(StateError('refresh failed'));
    expect(failure.data, [1]);
    expect(failure.error, isA<StateError>());
    expect(failure.refreshing, isFalse);
    final recovered = failure.startLoading().succeeded([2]);
    expect(recovered.data, [2]);
    expect(recovered.error, isNull);
    expect(recovered.loading, isFalse);
  });
  test('first load has loading state and clears a previous error', () {
    final state = AsyncState<int>()
        .failed(StateError('offline'))
        .startLoading();
    expect(state.data, isNull);
    expect(state.error, isNull);
    expect(state.loading, isTrue);
    expect(state.refreshing, isFalse);
  });
  test('new generation invalidates older request and dispose rejects all', () {
    final controller = RequestController();
    final old = controller.begin();
    final latest = controller.begin();
    expect(controller.isCurrent(old), isFalse);
    expect(controller.isCurrent(latest), isTrue);
    controller.invalidate();
    expect(controller.isCurrent(latest), isFalse);
    final pending = controller.begin();
    controller.dispose();
    expect(controller.isCurrent(pending), isFalse);
    expect(() => controller.begin(), throwsStateError);
  });
  test(
    'resource changes notify multiple listeners and close on dispose',
    () async {
      final changes = ResourceChanges();
      final first = <ResourceChange>[];
      final second = <ResourceChange>[];
      final subscription = changes.stream.listen(first.add);
      final finished = changes.stream.forEach(second.add);
      changes.emit(ResourceKind.members, teamId: 42);
      changes.emit(ResourceKind.matches);
      changes.dispose();
      await finished;
      expect(first.map((event) => event.kind), [
        ResourceKind.members,
        ResourceKind.matches,
      ]);
      expect(second.map((event) => event.teamId), [42, null]);
      expect(() => changes.emit(ResourceKind.teams), throwsStateError);
      changes.dispose();
      await subscription.cancel();
    },
  );
}
