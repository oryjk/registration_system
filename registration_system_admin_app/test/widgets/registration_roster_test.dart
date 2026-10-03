import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/design_system/design_system.dart';
import 'package:registration_system_admin_app/features/matches/domain/match_models.dart';
import 'package:registration_system_admin_app/features/matches/presentation/registration_roster.dart';

void main() {
  testWidgets('counts occupied attending places rather than account rows', (
    t,
  ) async {
    final group = RegistrationGroup(
      id: 'g',
      kind: 'individual_opponent',
      teamId: null,
      minPlayers: 5,
      maxPlayers: 12,
      status: 'open',
      registrations: [
        for (final status in [
          'attending',
          'unregistered',
          'leave',
          'absent',
          'cancelled',
          'unknown',
          'future',
        ])
          RegistrationEntry(
            userId: status.hashCode,
            nickname: status,
            realName: null,
            avatarUrl: null,
            memberRole: null,
            status: status,
            registrationCount: 3,
            paid: true,
          ),
      ],
    );
    await t.pumpWidget(
      MaterialApp(
        theme: AdminTheme.build(dark: true),
        home: Scaffold(
          body: SingleChildScrollView(child: RegistrationRoster(group: group)),
        ),
      ),
    );
    expect(find.text('参赛占用 3 人'), findsOneWidget);
    expect(find.text('报名 3 人'), findsNWidgets(7));
    expect(find.text('未报名'), findsOneWidget);
    expect(find.text('未知（future）'), findsOneWidget);
  });
}
