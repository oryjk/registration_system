import 'package:flutter/material.dart';
import '../tokens/component_tokens.dart';
import '../tokens/semantic_tokens.dart';

class SubmitBar extends StatelessWidget {
  const SubmitBar({
    super.key,
    required this.submitting,
    required this.onSubmit,
    required this.label,
  });
  final bool submitting;
  final VoidCallback? onSubmit;
  final String label;
  @override
  Widget build(BuildContext context) => SafeArea(
    top: false,
    child: Padding(
      padding: const EdgeInsets.all(AdminSpacing.field),
      child: SizedBox(
        width: double.infinity,
        child: FilledButton(
          onPressed: submitting ? null : onSubmit,
          child: Wrap(
            alignment: WrapAlignment.center,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: AdminSpacing.label,
            children: [
              if (submitting)
                const SizedBox(
                  width: AdminComponents.touchTarget / 2,
                  height: AdminComponents.touchTarget / 2,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              Text(submitting ? '提交中…' : label),
            ],
          ),
        ),
      ),
    ),
  );
}
