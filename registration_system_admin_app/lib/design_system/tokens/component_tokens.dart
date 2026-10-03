import 'primitives.dart';
import 'semantic_tokens.dart';

/// Component roles keep future screens independent of raw numeric values.
abstract final class AdminComponents {
  static const touchTarget = AdminScale.space12;
  static const controlRadius = AdminScale.space2;
  static const panelRadius = AdminScale.space3;
  static const controlPaddingX = AdminScale.space3;
  static const controlPaddingY = AdminScale.space3;
  static const panelPadding = AdminSpacing.panel;
  static const badgePaddingX = AdminScale.space2;
  static const badgePaddingY = AdminScale.space1;
  static const formMaxWidth = 480.0;
}
