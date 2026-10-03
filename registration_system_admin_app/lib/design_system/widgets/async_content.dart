import 'package:flutter/material.dart';
import '../../../core/state/async_state.dart';
import '../tokens/semantic_tokens.dart';

/// Viewport content: place in a bounded body/Expanded, not a scroll column.
class AsyncContent<T> extends StatelessWidget {
  const AsyncContent({
    super.key,
    required this.state,
    required this.builder,
    required this.retry,
    this.isEmpty,
    this.emptyMessage = '暂无数据',
  });
  final AsyncState<T> state;
  final Widget Function(BuildContext, T) builder;
  final VoidCallback retry;
  final bool Function(T)? isEmpty;
  final String emptyMessage;
  @override
  Widget build(BuildContext context) {
    final data = state.data;
    if (data == null && state.loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (data == null) {
      return Center(
        child: SingleChildScrollView(
          child: _feedback(context, state.error?.toString() ?? emptyMessage),
        ),
      );
    }
    return LayoutBuilder(
      builder: (context, constraints) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (state.refreshing) const LinearProgressIndicator(),
          if (state.error != null)
            ConstrainedBox(
              constraints: BoxConstraints(maxHeight: constraints.maxHeight / 2),
              child: SingleChildScrollView(
                child: _feedback(context, state.error.toString()),
              ),
            ),
          Expanded(
            child: isEmpty?.call(data) == true
                ? Center(
                    child: SingleChildScrollView(
                      child: _feedback(context, emptyMessage),
                    ),
                  )
                : builder(context, data),
          ),
        ],
      ),
    );
  }

  Widget _feedback(BuildContext context, String message) => Padding(
    padding: const EdgeInsets.all(AdminSpacing.field),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          liveRegion: true,
          child: Text(message, style: Theme.of(context).textTheme.bodyMedium),
        ),
        TextButton(onPressed: retry, child: const Text('重试')),
      ],
    ),
  );
}
