import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

/// Shared by MaterialApp and future date/time pickers.
abstract final class AdminLocalizations {
  static const locale = Locale('zh', 'CN');
  static const supportedLocales = [locale];
  static const delegates = [
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ];
}
