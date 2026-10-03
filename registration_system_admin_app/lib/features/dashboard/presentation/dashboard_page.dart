import 'package:flutter/material.dart';
import '../../../design_system/design_system.dart';
import '../../matches/domain/match_models.dart';
import '../../matches/presentation/match_card.dart';
import '../application/dashboard_controller.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({
    super.key,
    required this.controller,
    required this.username,
    required this.onMatch,
    required this.onCreateMatch,
    required this.onCreateTeam,
    required this.onTeams,
  });
  final DashboardController controller;
  final String username;
  final ValueChanged<MatchItem> onMatch;
  final VoidCallback onCreateMatch, onCreateTeam, onTeams;
  @override
  Widget build(BuildContext context) => AdminScaffold(
    title: '工作台',
    actions: [
      IconButton(
        tooltip: '刷新工作台',
        onPressed: controller.refresh,
        icon: const Icon(Icons.refresh),
      ),
    ],
    body: ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final state = controller.state;
        return RefreshIndicator(
          onRefresh: controller.refresh,
          child: ListView(
            key: const PageStorageKey('dashboard.scroll'),
            padding: const EdgeInsets.all(AdminSpacing.panel),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              Text(
                '你好，$username',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: AdminSpacing.field),
              StatusBadge(
                text: controller.healthy ? '服务连接正常' : '服务连接待检查',
                tone: controller.healthy
                    ? StatusTone.success
                    : StatusTone.warning,
              ),
              if (controller.healthError != null)
                Text(controller.healthError.toString()),
              const SizedBox(height: AdminSpacing.section),
              Wrap(
                spacing: AdminSpacing.label,
                runSpacing: AdminSpacing.label,
                children: [
                  FilledButton.icon(
                    onPressed: onCreateMatch,
                    icon: const Icon(Icons.add),
                    label: const Text('创建比赛'),
                  ),
                  OutlinedButton.icon(
                    onPressed: onCreateTeam,
                    icon: const Icon(Icons.group_add_outlined),
                    label: const Text('创建球队'),
                  ),
                  OutlinedButton.icon(
                    onPressed: onTeams,
                    icon: const Icon(Icons.people_outline),
                    label: const Text('成员与队费'),
                  ),
                ],
              ),
              const SizedBox(height: AdminSpacing.section),
              Text('近期比赛', style: Theme.of(context).textTheme.titleLarge),
              if (state.loading || state.refreshing)
                const LinearProgressIndicator(),
              if (state.error != null) ...[
                Text(
                  state.error.toString(),
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
                TextButton(
                  onPressed: controller.refresh,
                  child: const Text('重试读取近期比赛'),
                ),
              ],
              if (state.data?.items.isEmpty == true)
                const Padding(
                  padding: EdgeInsets.all(AdminSpacing.panel),
                  child: Text('暂无比赛，创建第一场比赛'),
                ),
              for (final match in state.data?.items ?? const <MatchItem>[])
                MatchCard(match: match, onTap: () => onMatch(match)),
            ],
          ),
        );
      },
    ),
  );
}
