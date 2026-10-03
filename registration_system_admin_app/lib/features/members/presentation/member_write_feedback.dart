import 'package:flutter/material.dart';
import '../../../design_system/design_system.dart';
import '../application/member_controller.dart';

String memberActionLabel(MemberWriteAction action) => switch (action) {
  MemberWriteAction.add => '添加成员',
  MemberWriteAction.update => '角色与状态',
  MemberWriteAction.remove => '移除成员',
  MemberWriteAction.captain => '队长任免',
  MemberWriteAction.paid => '会员标记',
  MemberWriteAction.profile => '球员资料',
};

class MemberWriteFeedback extends StatelessWidget {
  const MemberWriteFeedback({super.key, required this.controller});
  final MemberController controller;
  @override
  Widget build(BuildContext context) {
    final c = controller;
    if (c.writeOutcomeUncertain) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(MemberController.uncertainGuidance),
          for (final applied in [true, false])
            TextButton(
              onPressed: c.submitting
                  ? null
                  : () async {
                      final checked = await confirmAction(
                        context,
                        title: applied ? '已核实操作生效？' : '已核实操作未生效？',
                        message: applied
                            ? '将此项标记为成功并刷新读取，不再重复提交。'
                            : '只解除锁定，不会自动重复请求；请重新查询后操作。',
                      );
                      if (checked && context.mounted) {
                        c.acknowledgeOutcomeChecked(applied: applied);
                      }
                    },
              child: Text(applied ? '已核实生效，完成操作' : '已核实未生效，解除锁定'),
            ),
        ],
      );
    }
    if (c.results.isEmpty) return const SizedBox.shrink();
    return Semantics(
      liveRegion: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final result in c.results.values)
            Text(
              '${memberActionLabel(result.action)}${result.userId == null ? '' : '（用户 ${result.userId}）'}：${switch (result.outcome) {
                MemberWriteOutcome.succeeded => '已成功',
                MemberWriteOutcome.failed => '失败：${result.error}',
                MemberWriteOutcome.uncertain => '结果待确认',
              }}',
              style: result.outcome == MemberWriteOutcome.failed
                  ? TextStyle(color: Theme.of(context).colorScheme.error)
                  : null,
            ),
          if (c.writeSucceeded && c.state.error != null)
            const Text('操作成功，数据刷新失败。请刷新读取，勿重复操作。'),
        ],
      ),
    );
  }
}

/// Keep long feedback bounded so lists/forms retain a useful scroll viewport.
class MemberFeedbackArea extends StatelessWidget {
  const MemberFeedbackArea({
    super.key,
    required this.controller,
    required this.height,
  });
  final MemberController controller;
  final double height;
  @override
  Widget build(BuildContext context) => controller.results.isEmpty
      ? const SizedBox.shrink()
      : ConstrainedBox(
          constraints: BoxConstraints(maxHeight: height / 3),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AdminSpacing.field),
            child: MemberWriteFeedback(controller: controller),
          ),
        );
}
