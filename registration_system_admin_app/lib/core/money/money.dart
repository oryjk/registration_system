/// A field error that form callers can display without treating it as transport.
class AmountValidationError extends ArgumentError {
  AmountValidationError(String input)
    : super.value(input, 'amount', '请输入 0.01 至 10000.00 元，最多两位小数');
}

int parseAmountCents(String input) {
  final match = RegExp(r'^(\d+)(?:\.(\d{1,2}))?$').firstMatch(input.trim());
  if (match == null) throw AmountValidationError(input);
  final yuan = int.tryParse(match.group(1)!);
  // Validate before multiplication to prevent integer overflow.
  if (yuan == null || yuan > 10000) throw AmountValidationError(input);
  final fraction = (match.group(2) ?? '').padRight(2, '0');
  final cents = yuan * 100 + int.parse(fraction);
  if (cents < 1 || cents > 1000000) throw AmountValidationError(input);
  return cents;
}

String formatCents(int cents) {
  final amount = cents.abs();
  return '${cents < 0 ? '-' : ''}${amount ~/ 100}.'
      '${(amount % 100).toString().padLeft(2, '0')}';
}
