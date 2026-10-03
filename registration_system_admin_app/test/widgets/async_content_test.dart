import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/core/state/async_state.dart';
import 'package:registration_system_admin_app/design_system/widgets/async_content.dart';

void main() {
  testWidgets('refresh error retains content and offers retry', (tester) async {
    var retries = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AsyncContent<String>(
            state: const AsyncState(data: 'loaded', error: '网络不可用'),
            builder: (_, data) => Text(data),
            retry: () {
              retries++;
            },
          ),
        ),
      ),
    );
    expect(find.text('loaded'), findsOneWidget);
    expect(find.text('网络不可用'), findsOneWidget);
    await tester.tap(find.text('重试'));
    expect(retries, 1);
  });
  testWidgets('long refresh error scrolls without hiding loaded content', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 390);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(2)),
          child: Scaffold(
            body: AsyncContent<String>(
              state: AsyncState(
                data: 'loaded',
                error: List.filled(30, '网络请求失败，请稍后重试。').join(),
              ),
              builder: (_, data) => Text(data),
              retry: () {},
            ),
          ),
        ),
      ),
    );
    await tester.pump();
    expect(tester.takeException(), isNull);
    expect(find.text('loaded').hitTestable(), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('重试'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('重试').hitTestable(), findsOneWidget);
  });
  testWidgets('first load shows progress and empty state offers refresh', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AsyncContent<List<int>>(
            state: const AsyncState(loading: true),
            builder: (_, data) => Text('$data'),
            retry: () {},
          ),
        ),
      ),
    );
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AsyncContent<List<int>>(
            state: const AsyncState(data: []),
            isEmpty: (data) => data.isEmpty,
            builder: (_, data) => Text('$data'),
            retry: () {},
          ),
        ),
      ),
    );
    expect(find.text('暂无数据'), findsOneWidget);
    expect(find.text('重试'), findsOneWidget);
  });
}
