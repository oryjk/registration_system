import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/core/time/beijing_time.dart';
import 'package:registration_system_admin_app/features/team_fund/domain/fund_models.dart';

void main() {
  test(
    'new receipts use injected Beijing today across UTC midnight boundary',
    () {
      final today = BeijingClock.fromInstant(DateTime.utc(2026, 10, 2, 16, 1));
      expect(today.dateKey, '2026-10-03');
      for (final date in ['2026-10-02', '2026-10-03']) {
        expect(
          FundDraft(
            action: FundAction.credit,
            amountCents: 100,
            receivedOn: date,
          ).validate(today: today),
          isEmpty,
        );
      }
      expect(
        const FundDraft(
          action: FundAction.credit,
          amountCents: 100,
          receivedOn: '2026-10-04',
        ).validate(today: today)['date'],
        contains('不能晚于今天'),
      );
      expect(
        const FundDraft(
          action: FundAction.credit,
          amountCents: 100,
          receivedOn: '2026-02-30',
        ).validate(today: today)['date'],
        contains('有效'),
      );
    },
  );
  test(
    'structural restore accepts legacy future receipt for authoritative server confirmation',
    () {
      expect(
        const FundDraft(
          action: FundAction.credit,
          amountCents: 100,
          receivedOn: '9999-12-31',
        ).validate(),
        isEmpty,
      );
    },
  );
}
