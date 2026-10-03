import 'package:flutter/material.dart';
import '../tokens/component_tokens.dart';

/// Bounded, safe viewport for AsyncContent and scrolling forms. Borrowed content
/// owns its scroll/controller lifecycle. The action bar moves above the keyboard.
class AdminScaffold extends StatelessWidget {
  const AdminScaffold({
    super.key,
    required this.title,
    required this.body,
    this.actions,
    this.bottomBar,
    this.maxWidth = AdminComponents.formMaxWidth,
  });
  final String title;
  final Widget body;
  final List<Widget>? actions;
  final Widget? bottomBar;
  final double maxWidth;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(title), actions: actions),
    body: SafeArea(
      top: false,
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxWidth),
          child: SizedBox(
            width: double.infinity,
            height: double.infinity,
            child: body,
          ),
        ),
      ),
    ),
    bottomNavigationBar: bottomBar == null
        ? null
        : Padding(
            padding: EdgeInsets.only(
              bottom: MediaQuery.viewInsetsOf(context).bottom,
            ),
            child: Align(
              heightFactor: 1,
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: maxWidth),
                child: bottomBar,
              ),
            ),
          ),
  );
}
