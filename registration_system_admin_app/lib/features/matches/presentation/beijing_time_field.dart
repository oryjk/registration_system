import 'package:flutter/material.dart';
import '../../../core/time/beijing_time.dart';
import '../../../design_system/design_system.dart';
import 'match_card.dart';

class BeijingTimeField extends StatelessWidget {
  const BeijingTimeField({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
    this.enabled = true,
    this.clearable = false,
    this.error,
  });
  final String label;
  final BeijingClock? value;
  final ValueChanged<BeijingClock?> onChanged;
  final bool enabled, clearable;
  final String? error;
  Future<void> _pick(BuildContext context) async {
    final b = value ?? BeijingClock.fromInstant(DateTime.now().toUtc());
    final initial = DateTime.utc(b.year, b.month, b.day);
    final date = await showDatePicker(
      context: context,
      useRootNavigator: false,
      locale: AdminLocalizations.locale,
      initialDate: initial,
      firstDate: DateTime.utc(b.year < 2000 ? b.year : 2000),
      lastDate: DateTime.utc(b.year > 2100 ? b.year : 2100, 12, 31),
      helpText: '选择日期（北京时间）',
    );
    if (date == null || !context.mounted) return;
    final time = await showTimePicker(
      context: context,
      useRootNavigator: false,
      initialTime: TimeOfDay(hour: b.hour, minute: b.minute),
      helpText: '选择时间（北京时间）',
      builder: (context, child) => Localizations.override(
        context: context,
        locale: AdminLocalizations.locale,
        child: MediaQuery(
          data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
          child: child!,
        ),
      ),
    );
    if (time != null && context.mounted) {
      onChanged(
        BeijingClock(date.year, date.month, date.day, time.hour, time.minute),
      );
    }
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(label),
      OutlinedButton(
        onPressed: enabled ? () => _pick(context) : null,
        style: OutlinedButton.styleFrom(alignment: Alignment.centerLeft),
        child: Text(value == null ? '未设置，点击选择' : matchInstant(value!.toUtc())),
      ),
      if (clearable && value != null)
        TextButton(
          onPressed: enabled ? () => onChanged(null) : null,
          child: Text('清空$label'),
        ),
      if (error != null)
        Text(
          error!,
          style: TextStyle(color: Theme.of(context).colorScheme.error),
        ),
    ],
  );
}
