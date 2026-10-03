import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/state/resource_changes.dart';
import '../../../design_system/design_system.dart';
import '../application/match_list_controller.dart';
import '../domain/match_models.dart';
import 'match_card.dart';

/// Borrows controller and ResourceChanges; composition owns their disposal.
class MatchListPage extends StatefulWidget {
  const MatchListPage({
    super.key,
    required this.controller,
    required this.onOpenMatch,
    required this.onCreate,
    this.changes,
    this.loadOnStart = true,
  });
  final MatchListController controller;
  final ValueChanged<MatchItem> onOpenMatch;
  final VoidCallback onCreate;
  final ResourceChanges? changes;
  final bool loadOnStart;
  @override
  State<MatchListPage> createState() => _MatchListPageState();
}

class _MatchListPageState extends State<MatchListPage> {
  late final _search = TextEditingController(
    text: widget.controller.query.search,
  );
  final _scroll = ScrollController();
  StreamSubscription<ResourceChange>? _subscription;
  @override
  void initState() {
    super.initState();
    if (widget.loadOnStart) unawaited(widget.controller.refresh());
    _subscription = widget.changes?.stream.listen((e) {
      if (e.kind == ResourceKind.matches) {
        unawaited(widget.controller.refresh());
      }
    });
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _search.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _filter({String? status}) {
    if (_scroll.hasClients) _scroll.jumpTo(0);
    unawaited(
      widget.controller.setFilter(search: _search.text, status: status),
    );
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) {
      final c = widget.controller;
      return AdminScaffold(
        title: '比赛',
        actions: [
          IconButton(
            onPressed: widget.onCreate,
            tooltip: '创建比赛',
            icon: const Icon(Icons.add),
          ),
        ],
        body: LayoutBuilder(
          builder: (context, constraints) => Column(
            children: [
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: constraints.maxHeight / 2,
                ),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(AdminSpacing.field),
                  child: Column(
                    children: [
                      TextField(
                        controller: _search,
                        textInputAction: TextInputAction.search,
                        onSubmitted: (_) => _filter(),
                        decoration: InputDecoration(
                          labelText: '搜索比赛名称',
                          prefixIcon: const Icon(Icons.search),
                          suffixIcon: IconButton(
                            tooltip: '搜索比赛',
                            onPressed: _filter,
                            icon: const Icon(Icons.arrow_forward),
                          ),
                        ),
                      ),
                      const SizedBox(height: AdminSpacing.label),
                      Wrap(
                        spacing: AdminSpacing.label,
                        runSpacing: AdminSpacing.label,
                        children: [
                          for (final status in [
                            '',
                            'registering',
                            'ongoing',
                            'ended',
                            'cancelled',
                          ])
                            ChoiceChip(
                              label: Text(
                                status.isEmpty
                                    ? '全部'
                                    : matchStatusLabel(status),
                              ),
                              selected: (c.query.status ?? '') == status,
                              padding: const EdgeInsets.symmetric(
                                vertical: AdminSpacing.label,
                              ),
                              onSelected: (_) => _filter(status: status),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              Expanded(
                child: AsyncContent<MatchPage>(
                  state: c.state,
                  retry: () => unawaited(c.refresh()),
                  builder: (context, page) => RefreshIndicator(
                    onRefresh: c.refresh,
                    child: ListView(
                      controller: _scroll,
                      padding: const EdgeInsets.all(AdminSpacing.field),
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        if (page.items.isEmpty) ...[
                          const Text('暂无符合条件的比赛'),
                          TextButton(
                            onPressed: () {
                              _search.clear();
                              _filter(status: '');
                            },
                            child: const Text('清除筛选'),
                          ),
                          FilledButton(
                            onPressed: widget.onCreate,
                            child: const Text('创建比赛'),
                          ),
                        ],
                        for (final m in page.items) ...[
                          MatchCard(
                            match: m,
                            onTap: () => widget.onOpenMatch(m),
                          ),
                          const SizedBox(height: AdminSpacing.field),
                        ],
                        if (c.hasMore)
                          TextButton(
                            onPressed: c.loadingMore
                                ? null
                                : () => unawaited(c.loadMore()),
                            child: Text(c.loadingMore ? '正在加载…' : '加载更多'),
                          )
                        else if (page.items.isNotEmpty)
                          const Center(child: Text('已显示全部比赛')),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}
