import 'package:flutter_test/flutter_test.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:registration_system_admin_app/app/build_info_controller.dart';

void main() {
  test(
    'version reader supplies actual metadata, failure is explicit and retryable',
    () async {
      var fail = true;
      final controller = BuildInfoController(
        reader: () async {
          if (fail) throw StateError('offline metadata failure');
          return '2.3.4 (17)';
        },
      );
      await controller.refresh();
      expect(controller.version, isNull);
      expect(controller.error, '未获取构建版本');
      fail = false;
      await controller.refresh();
      expect(controller.version, '2.3.4 (17)');
      expect(controller.error, isNull);
      controller.dispose();
    },
  );
  test(
    'default adapter uses package metadata rather than compiled defaults',
    () async {
      PackageInfo.setMockInitialValues(
        appName: 'fixture',
        packageName: 'fixture.invalid',
        version: '3.2.1',
        buildNumber: '29',
        buildSignature: '',
      );
      final controller = BuildInfoController();
      await controller.refresh();
      expect(controller.version, '3.2.1 (29)');
      expect(controller.error, isNull);
      controller.dispose();
    },
  );
}
