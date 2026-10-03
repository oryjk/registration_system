import 'package:flutter_test/flutter_test.dart';
import 'package:registration_system_admin_app/core/time/beijing_time.dart';

void main() {
  test(
    'Go RFC3339 nanosecond timestamps retain Dart microsecond precision',
    () {
      expect(
        BeijingTime.parseInstant('2026-01-01T01:02:03.456789123Z'),
        DateTime.utc(2026, 1, 1, 1, 2, 3, 456, 789),
      );
    },
  );
  test('UTC late night becomes next Beijing date across year boundary', () {
    final clock = BeijingClock.fromInstant(
      BeijingTime.parseInstant('2025-12-31T23:59:00Z'),
    );
    expect(clock.dateKey, '2026-01-01');
    expect(clock.hour, 7);
    expect(clock.minute, 59);
  });
  test('legacy timezone-free instant is UTC independently of device zone', () {
    expect(
      BeijingTime.parseInstant('2025-12-31T16:30:00'),
      DateTime.utc(2025, 12, 31, 16, 30),
    );
    expect(
      BeijingTime.parseInstant('2026-01-01T00:30:00+08:00'),
      DateTime.utc(2025, 12, 31, 16, 30),
    );
  });
  test('Beijing wall clock submits UTC across previous year', () {
    expect(
      BeijingClock(2026, 1, 1, 0, 30).toUtc(),
      DateTime.utc(2025, 12, 31, 16, 30),
    );
  });
  test('pure date remains a calendar date without timezone conversion', () {
    expect(BeijingClock.fromDateKey('2026-01-01').dateKey, '2026-01-01');
    expect(() => BeijingTime.parseInstant('2026-01-01'), throwsFormatException);
  });
  test('invalid calendar fields and overflowing dates are rejected', () {
    expect(() => BeijingClock(2026, 2, 30, 12, 0), throwsArgumentError);
    expect(() => BeijingClock(2026, 1, 1, 24, 0), throwsArgumentError);
    expect(() => BeijingClock.fromDateKey('2026-02-30'), throwsFormatException);
    expect(
      () => BeijingTime.parseInstant('2026-02-30T00:00:00Z'),
      throwsFormatException,
    );
  });
  test(
    'instant conversion preserves sub-minute precision when round-tripped',
    () {
      final value = DateTime.utc(2026, 1, 1, 1, 2, 3, 456, 789);
      expect(BeijingClock.fromInstant(value).toUtc(), value);
    },
  );
}
