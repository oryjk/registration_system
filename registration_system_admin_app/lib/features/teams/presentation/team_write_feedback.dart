import 'package:flutter/material.dart';
import '../../../design_system/design_system.dart';
import '../application/team_controller.dart';

/// Outcome text is independent from read errors rendered by AsyncContent.
class TeamWriteFeedback extends StatelessWidget {
  const TeamWriteFeedback({super.key, required this.controller});
  final TeamController controller;
  @override
  Widget build(BuildContext context) {
    final c = controller;
    if (c.writeOutcomeUncertain) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(TeamController.uncertainGuidance),
          TextButton(
            onPressed: () async {
              final checked = await confirmAction(
                context,
                title: '已核实操作未生效？',
                message: '只有确认上次操作未生效，才可解除提交锁定。解除后不会自动重复请求。入队密码请先向球队负责人核实。',
              );
              if (checked && context.mounted) c.acknowledgeOutcomeChecked();
            },
            child: const Text('已核实未生效，解除锁定'),
          ),
        ],
      );
    }
    final error = c.writeError;
    if (error != null) {
      return Semantics(
        liveRegion: true,
        child: Text(
          '操作失败：$error',
          style: TextStyle(color: Theme.of(context).colorScheme.error),
        ),
      );
    }
    if (!c.writeSucceeded) return const SizedBox.shrink();
    final refreshFailed = c.state.error != null || c.detailState.error != null;
    return Semantics(
      liveRegion: true,
      child: Text(
        refreshFailed
            ? '操作成功，数据刷新失败。请重试读取，勿重复操作。'
            : switch (c.writeAction) {
                TeamWriteAction.save => '球队已保存',
                TeamWriteAction.delete => '球队已删除',
                TeamWriteAction.password => '入队密码已更新',
                null => '操作成功',
              },
      ),
    );
  }
}
