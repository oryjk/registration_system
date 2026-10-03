import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/design_system/theme_controller.dart';
import '../support/fake_storage.dart';

void main() {
  test('starts dark and loads saved light preference', () async {
    final controller = ThemeController(
      preferences: FakePreferencesStore(dark: false),
    );
    expect(controller.dark, isTrue);
    await controller.restore();
    expect(controller.dark, isFalse);
  });
  test(
    'persists selected theme, failed write retains prior theme and exposes error',
    () async {
      final store = FakePreferencesStore();
      final controller = ThemeController(preferences: store);
      await controller.setDark(false);
      expect(store.dark, isFalse);
      store.writeError = StateError('storage');
      await controller.setDark(true);
      expect(controller.dark, isFalse);
      expect(controller.error, isNotNull);
    },
  );
}
