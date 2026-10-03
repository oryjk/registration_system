import 'package:flutter/material.dart';
import '../tokens/component_tokens.dart';
import '../tokens/semantic_tokens.dart';

/// Generic person identity with wrapping metadata. Action controls belong below
/// the row so long names and enlarged text keep their available width.
class PersonRow extends StatelessWidget {
  const PersonRow({
    super.key,
    required this.name,
    this.avatarUrl,
    this.subtitle,
    this.details = const [],
    this.onTap,
  });
  final String name;
  final String? avatarUrl, subtitle;
  final List<Widget> details;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final fallback = ColoredBox(
      color: AdminColors.of(context).inset,
      child: const Center(child: Icon(Icons.person_outline)),
    );
    final image = avatarUrl?.trim().isNotEmpty == true
        ? Image.network(
            avatarUrl!,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => fallback,
          )
        : fallback;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AdminComponents.controlRadius),
      child: ConstrainedBox(
        constraints: const BoxConstraints(
          minHeight: AdminComponents.touchTarget,
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: AdminSpacing.label),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipOval(
                    child: SizedBox(
                      width: AdminComponents.touchTarget,
                      height: AdminComponents.touchTarget,
                      child: image,
                    ),
                  ),
                  const SizedBox(width: AdminSpacing.label),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name.isEmpty ? '未提供昵称' : name,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        if (subtitle != null)
                          Text(
                            subtitle!,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                      ],
                    ),
                  ),
                ],
              ),
              for (final detail in details) ...[
                const SizedBox(height: AdminSpacing.label),
                detail,
              ],
            ],
          ),
        ),
      ),
    );
  }
}
