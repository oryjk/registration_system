import 'package:flutter/material.dart';
import 'primitives.dart';

enum StatusTone { neutral, success, warning, danger, info }

@immutable
class AdminColors extends ThemeExtension<AdminColors> {
  const AdminColors({
    required this.muted,
    required this.inset,
    required this.success,
    required this.warning,
    required this.info,
  });
  factory AdminColors.forBrightness(bool dark) => AdminColors(
    muted: dark ? AdminPalette.neutral500 : AdminPalette.slate,
    inset: dark ? AdminPalette.neutral850 : AdminPalette.insetLight,
    success: dark ? AdminPalette.green400 : AdminPalette.green800,
    warning: dark ? AdminPalette.amber400 : AdminPalette.amber800,
    info: dark ? AdminPalette.blue400 : AdminPalette.blue800,
  );
  final Color muted;
  final Color inset;
  final Color success;
  final Color warning;
  final Color info;
  static AdminColors of(BuildContext context) =>
      Theme.of(context).extension<AdminColors>() ??
      AdminColors.forBrightness(
        Theme.of(context).brightness == Brightness.dark,
      );
  @override
  AdminColors copyWith({
    Color? muted,
    Color? inset,
    Color? success,
    Color? warning,
    Color? info,
  }) => AdminColors(
    muted: muted ?? this.muted,
    inset: inset ?? this.inset,
    success: success ?? this.success,
    warning: warning ?? this.warning,
    info: info ?? this.info,
  );
  @override
  AdminColors lerp(covariant AdminColors? other, double t) => other == null
      ? this
      : AdminColors(
          muted: Color.lerp(muted, other.muted, t)!,
          inset: Color.lerp(inset, other.inset, t)!,
          success: Color.lerp(success, other.success, t)!,
          warning: Color.lerp(warning, other.warning, t)!,
          info: Color.lerp(info, other.info, t)!,
        );
}

abstract final class AdminSpacing {
  static const field = AdminScale.space4;
  static const label = AdminScale.space2;
  static const panel = AdminScale.space5;
  static const section = AdminScale.space6;
}
