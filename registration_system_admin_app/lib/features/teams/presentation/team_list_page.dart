import 'dart:async';
import 'package:flutter/material.dart';
import '../../../design_system/design_system.dart';
import '../application/team_controller.dart';
import '../domain/team.dart';
import 'team_card.dart';

/// Borrows controller; route/tab composition owns disposal and navigation.
class TeamListPage extends StatefulWidget {
  const TeamListPage({
    super.key,
    required this.controller,
    required this.onOpenTeam,
    required this.onCreate,
    this.loadOnStart = true,
  });
  final TeamController controller;
  final ValueChanged<Team> onOpenTeam;
  final VoidCallback onCreate;
  final bool loadOnStart;
  @override
  State<TeamListPage> createState() => _TeamListPageState();
}

class _TeamListPageState extends State<TeamListPage> {
  late final _search = TextEditingController(text: widget.controller.search);
  @override
  void initState() {
    super.initState();
    if (widget.loadOnStart) unawaited(widget.controller.refresh());
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) {
      final c = widget.controller;
      return AdminScaffold(
        title: '球队',
        actions: [
          IconButton(
            onPressed: widget.onCreate,
            tooltip: '创建球队',
            icon: const Icon(Icons.add),
          ),
        ],
        body: LayoutBuilder(
          builder: (context, constraints) => Column(
            children: [
              // A flexible scroll region keeps filters usable in landscape/2x text.
              Flexible(
                flex: 0,
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxHeight: constraints.maxHeight / 2,
                  ),
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(AdminSpacing.field),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        TextField(
                          controller: _search,
                          onChanged: c.setSearch,
                          decoration: InputDecoration(
                            labelText: '搜索球队名称',
                            prefixIcon: const Icon(Icons.search),
                            suffixIcon: IconButton(
                              tooltip: '清除搜索',
                              onPressed: () {
                                _search.clear();
                                c.setSearch('');
                              },
                              icon: const Icon(Icons.clear),
                            ),
                          ),
                        ),
                        const SizedBox(height: AdminSpacing.label),
                        Wrap(
                          spacing: AdminSpacing.label,
                          runSpacing: AdminSpacing.label,
                          children: [
                            for (final status in ['', ...Team.editableStatuses])
                              ChoiceChip(
                                label: Text(
                                  status.isEmpty
                                      ? '全部'
                                      : teamStatusLabel(status),
                                ),
                                selected: (c.status ?? '') == status,
                                materialTapTargetSize:
                                    MaterialTapTargetSize.padded,
                                padding: const EdgeInsets.symmetric(
                                  vertical: AdminSpacing.label,
                                ),
                                onSelected: c.submitting
                                    ? null
                                    : (_) =>
                                          unawaited(c.refresh(status: status)),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              Expanded(
                child: AsyncContent<List<Team>>(
                  state: c.state,
                  retry: () => unawaited(c.refresh()),
                  builder: (context, teams) {
                    final filtered = c.filteredTeams;
                    return RefreshIndicator(
                      onRefresh: c.refresh,
                      child: ListView(
                        padding: const EdgeInsets.all(AdminSpacing.field),
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: [
                          if (c.state.error != null)
                            Text(
                              c.writeSucceeded
                                  ? '操作成功，列表刷新失败。请重试读取，勿重复操作。'
                                  : '列表刷新失败，当前显示上次加载的数据。',
                            ),
                          if (filtered.isEmpty) ...[
                            Text(
                              teams.isEmpty &&
                                      c.status == null &&
                                      c.search.isEmpty
                                  ? '暂无球队，创建第一支球队。'
                                  : '筛选无结果',
                            ),
                            const SizedBox(height: AdminSpacing.field),
                            if (c.status != null || c.search.isNotEmpty)
                              TextButton(
                                onPressed: () {
                                  _search.clear();
                                  c.setSearch('');
                                  unawaited(c.refresh(status: ''));
                                },
                                child: const Text('清除筛选'),
                              ),
                            FilledButton(
                              onPressed: widget.onCreate,
                              child: const Text('创建球队'),
                            ),
                          ],
                          for (final team in filtered) ...[
                            TeamCard(
                              team: team,
                              onTap: () => widget.onOpenTeam(team),
                            ),
                            const SizedBox(height: AdminSpacing.field),
                          ],
                        ],
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}
