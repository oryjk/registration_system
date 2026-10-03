import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:registration_system_admin_app/app/app_dependencies.dart';
import 'package:registration_system_admin_app/core/network/api_error.dart';
import 'package:registration_system_admin_app/features/session/application/session_controller.dart';
import '../support/fake_storage.dart';
import 'http_session_repository_test.dart' show adminJson;

void main() {
  test(
    'composition routes real 401 through session controller and preserves other secrets',
    () async {
      var expire = false;
      final store = FakeSecureStore(
        initialValues: {'fund.pending.7': 'fixture'},
      );
      final dependencies = AppDependencies(
        baseUrl: Uri.parse('https://example.test/regist-v3'),
        storage: store,
        preferences: FakePreferencesStore(dark: false),
        transport: MockClient((request) async {
          if (request.url.path.endsWith('/auth/login')) {
            return http.Response(
              jsonEncode({
                'code': 0,
                'message': 'ok',
                'data': {'access_token': 'new', 'admin': adminJson},
              }),
              200,
            );
          }
          return http.Response(
            jsonEncode(
              expire
                  ? {'code': 401, 'message': 'expired', 'data': null}
                  : {'code': 0, 'message': 'ok', 'data': adminJson},
            ),
            expire ? 401 : 200,
          );
        }),
      );
      addTearDown(dependencies.dispose);
      await dependencies.initialize();
      expect(dependencies.theme.dark, isFalse);
      await dependencies.session.login('operator', 'fixture');
      expect(dependencies.session.state.phase, SessionPhase.signedIn);
      expire = true;
      await expectLater(
        dependencies.api.request('GET', '/auth/me'),
        throwsA(isA<ApiError>()),
      );
      expect(dependencies.session.state.phase, SessionPhase.signedOut);
      expect(store.values, {'fund.pending.7': 'fixture'});
    },
  );
}
