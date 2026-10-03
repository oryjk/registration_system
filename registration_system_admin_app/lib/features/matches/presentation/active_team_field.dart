import 'dart:async';
import 'package:flutter/material.dart';
import '../../../design_system/design_system.dart';
import '../../teams/domain/team_repository.dart';

/// Selection always uses actual active teams from the repository, never IDs typed
/// by an operator. The field owns only its request generation/local sheet state.
class ActiveTeamField extends StatefulWidget {
  const ActiveTeamField({
    super.key,
    required this.repository,
    required this.value,
    required this.onChanged,
    this.enabled = true,
    this.error,
  });
  final TeamRepository repository;
  final int? value;
  final ValueChanged<int?> onChanged;
  final bool enabled;
  final String? error;
  @override
  State<ActiveTeamField> createState() => _ActiveTeamFieldState();
}

class _ActiveTeamFieldState extends State<ActiveTeamField> {
  List<Team> _teams = [];
  Object? _error;
  bool _loading = true;
  int _generation = 0;
  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final teams = await widget.repository.list(status: 'active');
      if (!mounted || generation != _generation) return;
      setState(() => _teams = teams.where((t) => t.isActive).toList());
      if (widget.value != null && !_teams.any((t) => t.id == widget.value)) {
        widget.onChanged(null);
      }
    } catch (e) {
      if (mounted && generation == _generation) setState(() => _error = e);
    } finally {
      if (mounted && generation == _generation) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _select() async {
    final chosen = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => _TeamSheet(teams: _teams),
    );
    if (mounted && chosen != null && widget.enabled) widget.onChanged(chosen);
  }

  @override
  Widget build(BuildContext context) {
    final selected = _teams.where((t) => t.id == widget.value).firstOrNull;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('主队（仅启用球队）'),
        if (_loading) const LinearProgressIndicator(),
        if (_error != null) ...[
          Text('球队读取失败：$_error'),
          TextButton(
            onPressed: widget.enabled ? () => unawaited(_load()) : null,
            child: const Text('重试读取球队'),
          ),
        ] else if (!_loading && _teams.isEmpty) ...[
          const Text('暂无启用球队，请先创建或启用球队。'),
          TextButton(
            onPressed: widget.enabled ? () => unawaited(_load()) : null,
            child: const Text('重新读取球队'),
          ),
        ] else
          OutlinedButton(
            onPressed: widget.enabled && !_loading ? _select : null,
            style: OutlinedButton.styleFrom(alignment: Alignment.centerLeft),
            child: Text(selected?.name ?? '选择主队'),
          ),
        if (widget.error != null)
          Text(
            widget.error!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
      ],
    );
  }
}

class _TeamSheet extends StatefulWidget {
  const _TeamSheet({required this.teams});
  final List<Team> teams;
  @override
  State<_TeamSheet> createState() => _TeamSheetState();
}

class _TeamSheetState extends State<_TeamSheet> {
  String _search = '';
  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
    child: SizedBox(
      height: MediaQuery.sizeOf(context).height * .75,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(AdminSpacing.field),
            child: Column(
              children: [
                Text('选择主队', style: Theme.of(context).textTheme.titleLarge),
                TextField(
                  decoration: const InputDecoration(
                    labelText: '搜索启用球队',
                    prefixIcon: Icon(Icons.search),
                  ),
                  onChanged: (s) =>
                      setState(() => _search = s.trim().toLowerCase()),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              children: [
                for (final team in widget.teams.where(
                  (t) => t.name.toLowerCase().contains(_search),
                ))
                  ListTile(
                    title: Text(team.name),
                    subtitle: Text('编号 ${team.id}'),
                    onTap: () => Navigator.of(context).pop(team.id),
                  ),
                if (!widget.teams.any(
                  (t) => t.name.toLowerCase().contains(_search),
                ))
                  const Padding(
                    padding: EdgeInsets.all(AdminSpacing.field),
                    child: Text('没有匹配的启用球队'),
                  ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
