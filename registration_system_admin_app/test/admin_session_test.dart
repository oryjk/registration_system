import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/services/admin_session.dart';

void main() {
  test('default admin api url uses localhost for adb reverse', () {
    expect(defaultAdminApiBaseUrl, 'http://127.0.0.1:18080/api/admin');
  });

  test(
    'android stored emulator host url migrates to adb reverse localhost',
    () {
      expect(
        resolveStoredAdminApiBaseUrl(
          'http://10.0.2.2:18080/api/admin',
          isAndroid: true,
        ),
        'http://127.0.0.1:18080/api/admin',
      );
    },
  );
}
