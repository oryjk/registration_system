import 'package:flutter/material.dart';
import '../tokens/component_tokens.dart';
import '../tokens/semantic_tokens.dart';

class StatusBadge extends StatelessWidget {
  const StatusBadge({
    super.key,
    required this.text,
    this.tone = StatusTone.neutral,
  });
  final String text;
  final StatusTone tone;
  @override
  Widget build(BuildContext context) {
    final colors = AdminColors.of(context);
    final color = switch (tone) {
      StatusTone.neutral => colors.muted,
      StatusTone.success => colors.success,
      StatusTone.warning => colors.warning,
      StatusTone.danger => Theme.of(context).colorScheme.error,
      StatusTone.info => colors.info,
    };
    return Semantics(
      label: text,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(AdminComponents.controlRadius),
          border: Border.all(color: color.withValues(alpha: 0.35)),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AdminComponents.badgePaddingX,
            vertical: AdminComponents.badgePaddingY,
          ),
          child: Text(
            text,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: color),
          ),
        ),
      ),
    );
  }
}
