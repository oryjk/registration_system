import 'package:flutter/material.dart';
import '../../../core/time/beijing_time.dart';
import '../../../design_system/design_system.dart';
import '../domain/match_models.dart';

String matchInstant(DateTime instant) {
  final b = BeijingClock.fromInstant(instant);
  return '${b.dateKey} ${b.hour.toString().padLeft(2, '0')}:${b.minute.toString().padLeft(2, '0')}（北京时间）';
}

String matchStatusLabel(String raw) => enumLabel(raw, const {
  'registering': '报名中',
  'ongoing': '进行中',
  'ended': '已结束',
  'cancelled': '已取消',
});
String matchScore(MatchItem m) => m.hostScore == null || m.awayScore == null
    ? '比分未录入'
    : '${m.hostScore} : ${m.awayScore}';
String matchTeams(MatchItem m) =>
    '${m.hostTeamName.isEmpty ? '散人主队' : m.hostTeamName}  vs  ${m.awayTeamName?.isNotEmpty == true
        ? m.awayTeamName
        : m.opponentName?.isNotEmpty == true
        ? m.opponentName
        : '对手待定'}';
StatusTone matchStatusTone(String raw) => switch (raw) {
  'registering' => StatusTone.info,
  'ongoing' => StatusTone.success,
  'cancelled' => StatusTone.danger,
  _ => StatusTone.neutral,
};

class MatchCard extends StatelessWidget {
  const MatchCard({super.key, required this.match, required this.onTap});
  final MatchItem match;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Card(
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AdminComponents.panelRadius),
      child: Padding(
        padding: const EdgeInsets.all(AdminComponents.panelPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(match.name, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: AdminSpacing.label),
            Wrap(
              spacing: AdminSpacing.label,
              runSpacing: AdminSpacing.label,
              children: [
                StatusBadge(
                  text: match.statusLabel,
                  tone: matchStatusTone(match.status),
                ),
                StatusBadge(text: match.publicationModeLabel),
              ],
            ),
            const SizedBox(height: AdminSpacing.field),
            Text(matchInstant(match.startTime)),
            Text(match.location),
            const SizedBox(height: AdminSpacing.label),
            Text(matchTeams(match)),
            if (match.hostScore != null || match.awayScore != null)
              Text(matchScore(match)),
          ],
        ),
      ),
    ),
  );
}
