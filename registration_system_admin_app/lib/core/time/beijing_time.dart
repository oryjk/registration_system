/// API instants are UTC. Legacy timezone-free timestamps are interpreted as UTC.
abstract final class BeijingTime {
  static final _instantPattern = RegExp(
    r'^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:?\d{2})?$',
  );

  static DateTime parseInstant(String value) {
    final match = _instantPattern.firstMatch(value);
    if (match == null) throw FormatException('Invalid instant', value);
    final fields = [for (var i = 1; i <= 6; i++) int.parse(match.group(i)!)];
    try {
      BeijingClock(
        fields[0],
        fields[1],
        fields[2],
        fields[3],
        fields[4],
        fields[5],
      );
    } on ArgumentError {
      throw FormatException('Invalid instant calendar fields', value);
    }
    final zone = match.group(7);
    if (zone != null && zone != 'Z') {
      final digits = zone.substring(1).replaceAll(':', '');
      if (int.parse(digits.substring(0, 2)) > 23 ||
          int.parse(digits.substring(2)) > 59) {
        throw FormatException('Invalid instant offset', value);
      }
    }
    return DateTime.parse(zone == null ? '${value}Z' : value).toUtc();
  }
}

/// Beijing wall-clock fields, represented without relying on the device zone.
class BeijingClock {
  BeijingClock(
    this.year,
    this.month,
    this.day,
    this.hour,
    this.minute, [
    this.second = 0,
    this.millisecond = 0,
    this.microsecond = 0,
  ]) {
    final clock = _wallClock;
    if (year < 1 ||
        year > 9999 ||
        clock.year != year ||
        clock.month != month ||
        clock.day != day ||
        clock.hour != hour ||
        clock.minute != minute ||
        clock.second != second ||
        clock.millisecond != millisecond ||
        clock.microsecond != microsecond) {
      throw ArgumentError('Invalid Beijing wall-clock fields');
    }
  }

  factory BeijingClock.fromInstant(DateTime instant) {
    final clock = instant.toUtc().add(_offset);
    return BeijingClock(
      clock.year,
      clock.month,
      clock.day,
      clock.hour,
      clock.minute,
      clock.second,
      clock.millisecond,
      clock.microsecond,
    );
  }

  /// Pure dates retain their calendar semantics; no instant conversion occurs.
  factory BeijingClock.fromDateKey(String value) {
    final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(value);
    if (match == null) throw FormatException('Invalid date', value);
    try {
      return BeijingClock(
        int.parse(match.group(1)!),
        int.parse(match.group(2)!),
        int.parse(match.group(3)!),
        0,
        0,
      );
    } on ArgumentError {
      throw FormatException('Invalid date calendar fields', value);
    }
  }

  static const _offset = Duration(hours: 8);
  final int year;
  final int month;
  final int day;
  final int hour;
  final int minute;
  final int second;
  final int millisecond;
  final int microsecond;

  DateTime get _wallClock => DateTime.utc(
    year,
    month,
    day,
    hour,
    minute,
    second,
    millisecond,
    microsecond,
  );

  DateTime toUtc() => _wallClock.subtract(_offset);

  String get dateKey =>
      '${year.toString().padLeft(4, '0')}-'
      '${month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';
}
