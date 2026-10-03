import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/core/money/money.dart';

void main() {
  test('decimal input converts exactly to integer cents', () {
    expect(parseAmountCents('0.29'), 29);
    expect(parseAmountCents('0.01'), 1);
    expect(parseAmountCents('12.3'), 1230);
    expect(parseAmountCents(' 12 '), 1200);
    expect(parseAmountCents('10000.00'), 1000000);
  });
  test('invalid or excessive money fails field validation', () {
    for (final value in [
      '',
      '0',
      '0.00',
      '-1',
      '+1',
      '1e2',
      '.29',
      '1.',
      '1.001',
      '1,000',
      '10000.01',
      '999999999999999999999999999999',
    ]) {
      expect(
        () => parseAmountCents(value),
        throwsA(isA<AmountValidationError>()),
        reason: value,
      );
    }
    expect(() => parseAmountCents('10000.01'), throwsArgumentError);
  });
  test('integer balances format with exact two decimal places', () {
    expect(formatCents(29), '0.29');
    expect(formatCents(1000000), '10000.00');
    expect(formatCents(0), '0.00');
    expect(formatCents(-29), '-0.29');
  });
}
