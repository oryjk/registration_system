import 'package:flutter/material.dart';
import '../tokens/component_tokens.dart';
import '../tokens/semantic_tokens.dart';

/// Generic, intrinsic-height section; long labels and enlarged text may wrap.
class FormSection extends StatelessWidget {
  const FormSection({
    super.key,
    required this.title,
    required this.children,
    this.description,
  });
  final String title;
  final String? description;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(AdminComponents.panelPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          if (description != null) ...[
            const SizedBox(height: AdminSpacing.label),
            Text(description!, style: Theme.of(context).textTheme.bodySmall),
          ],
          for (final child in children) ...[
            const SizedBox(height: AdminSpacing.field),
            child,
          ],
        ],
      ),
    ),
  );
}
