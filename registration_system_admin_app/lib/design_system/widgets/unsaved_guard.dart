import 'package:flutter/material.dart';
import 'confirm_action.dart';

class UnsavedGuard extends StatefulWidget {
  const UnsavedGuard({
    super.key,
    required this.dirty,
    required this.child,
    this.blocked = false,
  });
  final bool dirty;

  /// In-flight writes cannot be abandoned through a back/unsaved dialog.
  final bool blocked;
  final Widget child;
  @override
  State<UnsavedGuard> createState() => _UnsavedGuardState();
}

class _UnsavedGuardState extends State<UnsavedGuard> {
  bool _allowExit = false;
  bool _asking = false;
  @override
  Widget build(BuildContext context) => PopScope<Object?>(
    canPop: !widget.blocked && (!widget.dirty || _allowExit),
    onPopInvokedWithResult: (didPop, result) async {
      if (didPop || _asking || widget.blocked || !widget.dirty) return;
      _asking = true;
      final navigator = Navigator.of(context);
      final confirmed = await confirmAction(
        context,
        title: '放弃未保存的修改？',
        message: '返回后，本次修改将不会保存。',
      );
      _asking = false;
      if (!mounted || !confirmed) return;
      setState(() => _allowExit = true);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) navigator.pop(result);
      });
    },
    child: widget.child,
  );
}
