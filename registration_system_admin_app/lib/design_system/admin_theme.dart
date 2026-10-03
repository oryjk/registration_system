import 'package:flutter/material.dart';
import 'tokens/component_tokens.dart';
import 'tokens/primitives.dart';
import 'tokens/semantic_tokens.dart';

abstract final class AdminTheme {
  static ThemeData build({required bool dark}) {
    final colors = AdminColors.forBrightness(dark);
    final scheme =
        ColorScheme.fromSeed(
          seedColor: dark ? AdminPalette.teal400 : AdminPalette.teal700,
          brightness: dark ? Brightness.dark : Brightness.light,
        ).copyWith(
          primary: dark ? AdminPalette.teal400 : AdminPalette.teal700,
          onPrimary: dark ? AdminPalette.teal950 : AdminPalette.white,
          surface: dark ? AdminPalette.neutral900 : AdminPalette.white,
          onSurface: dark ? AdminPalette.neutral100 : AdminPalette.ink,
          onSurfaceVariant: colors.muted,
          outline: dark ? AdminPalette.neutral750 : AdminPalette.borderLight,
          error: dark ? AdminPalette.red400 : AdminPalette.red600,
        );
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(AdminComponents.controlRadius),
      borderSide: BorderSide(color: scheme.outline),
    );
    final base = ThemeData(useMaterial3: true, colorScheme: scheme);
    return base.copyWith(
      scaffoldBackgroundColor: dark
          ? AdminPalette.neutral950
          : AdminPalette.neutral50,
      extensions: [colors],
      textTheme: base.textTheme.copyWith(
        bodyLarge: TextStyle(
          fontSize: AdminScale.fontBody,
          height: 1.5,
          color: scheme.onSurface,
        ),
        bodyMedium: TextStyle(
          fontSize: AdminScale.fontBody,
          height: 1.5,
          color: scheme.onSurface,
        ),
        bodySmall: TextStyle(
          fontSize: AdminScale.fontSmall,
          height: 1.5,
          color: colors.muted,
        ),
        titleMedium: TextStyle(
          fontSize: AdminScale.fontSection,
          height: 1.35,
          fontWeight: FontWeight.w600,
          color: scheme.onSurface,
        ),
        headlineSmall: TextStyle(
          fontSize: AdminScale.fontTitle,
          height: 1.35,
          fontWeight: FontWeight.w600,
          color: scheme.onSurface,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colors.inset,
        border: border,
        enabledBorder: border,
        focusedBorder: border.copyWith(
          borderSide: BorderSide(color: scheme.primary, width: 2),
        ),
        errorBorder: border.copyWith(
          borderSide: BorderSide(color: scheme.error),
        ),
        focusedErrorBorder: border.copyWith(
          borderSide: BorderSide(color: scheme.error, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AdminComponents.controlPaddingX,
          vertical: AdminComponents.controlPaddingY,
        ),
        errorMaxLines: 4,
        helperMaxLines: 4,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(
            AdminComponents.touchTarget,
            AdminComponents.touchTarget,
          ),
          textStyle: const TextStyle(
            fontSize: AdminScale.fontBody,
            fontWeight: FontWeight.w500,
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: AdminComponents.controlPaddingX,
            vertical: AdminComponents.controlPaddingY,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AdminComponents.controlRadius),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(
            AdminComponents.touchTarget,
            AdminComponents.touchTarget,
          ),
          textStyle: const TextStyle(fontSize: AdminScale.fontBody),
          padding: const EdgeInsets.symmetric(
            horizontal: AdminComponents.controlPaddingX,
            vertical: AdminComponents.controlPaddingY,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AdminComponents.controlRadius),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          minimumSize: const Size(
            AdminComponents.touchTarget,
            AdminComponents.touchTarget,
          ),
          textStyle: const TextStyle(fontSize: AdminScale.fontBody),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          minimumSize: const Size(
            AdminComponents.touchTarget,
            AdminComponents.touchTarget,
          ),
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: scheme.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AdminComponents.panelRadius),
          side: BorderSide(color: scheme.outline.withValues(alpha: 0.5)),
        ),
      ),
      dialogTheme: DialogThemeData(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AdminComponents.panelRadius),
        ),
      ),
    );
  }
}
