import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../../core/network/api_error.dart';
import '../../../core/state/async_state.dart';
import '../../../core/state/request_controller.dart';
import '../../../core/state/resource_changes.dart';
import '../domain/member_repository.dart';
import '../domain/member_validation.dart';

enum MemberWriteAction { add, update, remove, captain, paid, profile }

enum MemberWriteOutcome { succeeded, failed, uncertain }

class MemberWriteResult {
  const MemberWriteResult(this.action, this.outcome, {this.userId, this.error});
  final MemberWriteAction action;
  final MemberWriteOutcome outcome;
  final int? userId;
  final Object? error;
}

/// Account-scoped controller owned by composition. Pages borrow it. Each action
/// has its own result; a later failure never erases a confirmed profile success.
class MemberController extends ChangeNotifier {
  MemberController({
    required MemberRepository repository,
    required this.teamId,
    ResourceChanges? changes,
  }) : _repository = repository,
       _changes = changes {
    _subscription = changes?.stream.listen((event) {
      if (!_disposed &&
          !_submitting &&
          (event.kind == ResourceKind.members ||
              event.kind == ResourceKind.teams) &&
          (event.teamId == null || event.teamId == teamId)) {
        unawaited(load());
      }
    });
  }
  final MemberRepository _repository;
  final int teamId;
  final ResourceChanges? _changes;
  StreamSubscription<ResourceChange>? _subscription;
  final _reads = RequestController(),
      _searches = RequestController(),
      _writes = RequestController();
  bool _disposed = false,
      _submitting = false,
      _uncertain = false,
      _missing = false;
  AsyncState<MemberManagement> _state = const AsyncState();
  AsyncState<List<MemberCandidate>> _candidateState = const AsyncState();
  String _query = '';
  final Map<MemberWriteAction, MemberWriteResult> _results = {};
  MemberWriteResult? _lastResult;
  Map<String, String> _fieldErrors = const {};
  AsyncState<MemberManagement> get state => _state;
  AsyncState<List<MemberCandidate>> get candidateState => _candidateState;
  String get query => _query;
  bool get submitting => _submitting;
  bool get writeSucceeded =>
      _lastResult?.outcome == MemberWriteOutcome.succeeded;
  bool get writeOutcomeUncertain => _uncertain;
  bool get missing => _missing;
  Object? get writeError => _lastResult?.error;
  MemberWriteAction? get writeAction => _lastResult?.action;
  MemberWriteResult? get lastResult => _lastResult;
  Map<MemberWriteAction, MemberWriteResult> get results =>
      Map.unmodifiable(_results);
  Map<String, String> get fieldErrors => _fieldErrors;
  bool get locked => _disposed || _submitting || _uncertain;
  bool get canManageTeam =>
      !locked && !_missing && (_state.data?.team.canManage ?? false);

  /// Lookup by USER ID, not Member.id (the membership-row ID).
  Member? memberById(int userId) {
    for (final m in _state.data?.members ?? const <Member>[]) {
      if (m.userId == userId) return m;
    }
    return null;
  }

  bool canManage(Member member) =>
      canManageTeam && (memberById(member.userId)?.known ?? false);
  bool isCaptain(Member member) =>
      _state.data?.team.captainId == member.userId ||
      memberById(member.userId)?.role == 'captain';
  bool canEdit(Member member) => canManage(member) && !isCaptain(member);
  bool canAssignCaptain(Member member) =>
      canManage(member) && memberById(member.userId)?.status == 'active';
  Future<void> load() async {
    if (_disposed || _submitting) return;
    await _load();
  }

  Future<void> _load() async {
    final generation = _reads.begin();
    _state = _state.startLoading();
    notifyListeners();
    try {
      final result = await _repository.list(teamId);
      if (_reads.isCurrent(generation)) {
        _state = _state.succeeded(result);
        _missing = false;
      }
    } catch (error) {
      if (_reads.isCurrent(generation)) {
        _missing = _notFound(error);
        _state = _missing ? AsyncState(error: error) : _state.failed(error);
      }
    }
    if (_reads.isCurrent(generation)) notifyListeners();
  }

  Future<void> searchCandidates(String query) async {
    if (_disposed || _submitting) return;
    _query = query.trim();
    final requested = _query;
    final generation = _searches.begin();
    _candidateState = const AsyncState(loading: true);
    notifyListeners();
    try {
      final result = await _repository.candidates(teamId, requested);
      if (_searches.isCurrent(generation)) {
        _candidateState = AsyncState(data: List.unmodifiable(result));
      }
    } catch (error) {
      if (_searches.isCurrent(generation)) {
        _candidateState = AsyncState(error: error);
      }
    }
    if (_searches.isCurrent(generation)) notifyListeners();
  }

  void _reject(
    MemberWriteAction action,
    String message, {
    int? userId,
    Map<String, String> fields = const {},
  }) {
    if (locked) return;
    _fieldErrors = Map.unmodifiable(fields);
    _record(
      MemberWriteResult(
        action,
        MemberWriteOutcome.failed,
        userId: userId,
        error: ApiError(message: message, kind: ApiErrorKind.validation),
      ),
    );
    notifyListeners();
  }

  void _record(MemberWriteResult result) {
    _lastResult = result;
    _results[result.action] = result;
  }

  Future<void> addCandidate(MemberCandidate candidate, String role) async {
    if (locked) return;
    final found =
        _candidateState.data?.any((c) => identical(c, candidate)) ?? false;
    if (!canManageTeam ||
        !found ||
        _candidateState.loading ||
        _candidateState.error != null ||
        !MemberValidation.role(role)) {
      _reject(
        MemberWriteAction.add,
        '请从当前查询结果选择球员及有效角色；队长需单独任命',
        userId: candidate.userId,
      );
      return;
    }
    await _write(
      MemberWriteAction.add,
      candidate.userId,
      () => _repository.add(teamId, candidate.userId, role),
    );
  }

  Future<void> updateMember(Member member, String role, String status) async {
    if (locked) return;
    if (!canEdit(member) ||
        !MemberValidation.role(role) ||
        !MemberValidation.status(status)) {
      _reject(
        MemberWriteAction.update,
        '当前成员不能普通编辑，请先取消或更换队长，并确认角色与状态',
        userId: member.userId,
      );
      return;
    }
    await _write(
      MemberWriteAction.update,
      member.userId,
      () => _repository.update(teamId, member.userId, role, status),
    );
  }

  Future<void> removeMember(Member member) async {
    if (locked) return;
    if (!canEdit(member)) {
      _reject(
        MemberWriteAction.remove,
        '当前成员不能移除，请先取消或更换队长',
        userId: member.userId,
      );
      return;
    }
    await _write(
      MemberWriteAction.remove,
      member.userId,
      () => _repository.remove(teamId, member.userId),
    );
  }

  Future<void> assignCaptain(int? userId) async {
    if (locked) return;
    final member = userId == null ? null : memberById(userId);
    if (!canManageTeam ||
        (userId != null && (member == null || !canAssignCaptain(member)))) {
      _reject(
        MemberWriteAction.captain,
        '队长必须是当前已启用且资料状态明确的球队成员',
        userId: userId,
      );
      return;
    }
    await _write(
      MemberWriteAction.captain,
      userId,
      () => _repository.setCaptain(teamId, userId),
    );
  }

  Future<void> setPaid(Member member, bool paid) async {
    if (locked) return;
    if (!canManage(member)) {
      _reject(MemberWriteAction.paid, '成员不存在或状态未知，请刷新', userId: member.userId);
      return;
    }
    await _write(
      MemberWriteAction.paid,
      member.userId,
      () => _repository.setPaid(teamId, member.userId, paid),
    );
  }

  Future<void> saveProfile(Member member, String? name, String? phone) async {
    if (locked) return;
    final fields = MemberValidation.profile(name, phone);
    if (!canManage(member) || fields.isNotEmpty) {
      _reject(
        MemberWriteAction.profile,
        fields.isEmpty ? '成员不存在或状态未知，请刷新' : fields.values.first,
        userId: member.userId,
        fields: fields,
      );
      return;
    }
    await _write(MemberWriteAction.profile, member.userId, () async {
      final p = await _repository.updateProfile(
        member.userId,
        realName: name,
        phone: phone,
      );
      if (_disposed) return null;
      final current = _state.data!;
      return MemberManagement(
        team: current.team,
        members: current.members
            .map(
              (m) => m.userId != p.id
                  ? m
                  : Member(
                      id: m.id,
                      userId: m.userId,
                      nickname: p.nickname,
                      avatarUrl: p.avatarUrl,
                      realName: p.realName,
                      phoneNumber: p.phoneNumber,
                      role: m.role,
                      status: m.status,
                      joinedAt: m.joinedAt,
                      balanceCents: m.balanceCents,
                      isPaidMember: m.isPaidMember,
                      lastRechargeAt: m.lastRechargeAt,
                    ),
            )
            .toList(),
      );
    });
  }

  Future<void> _write(
    MemberWriteAction action,
    int? userId,
    Future<MemberManagement?> Function() request,
  ) async {
    final generation = _writes.begin();
    _reads.invalidate();
    _searches.invalidate();
    _submitting = true;
    _lastResult = null;
    _fieldErrors = const {};
    _state = AsyncState(data: _state.data);
    _candidateState = const AsyncState();
    notifyListeners();
    try {
      final result = await request();
      if (!_writes.isCurrent(generation)) return;
      if (result != null) _state = AsyncState(data: result);
      _record(
        MemberWriteResult(action, MemberWriteOutcome.succeeded, userId: userId),
      );
      _notifyChanges(action);
      notifyListeners();
      await _load();
    } catch (error) {
      if (_writes.isCurrent(generation)) {
        _uncertain = error is ApiError && error.uncertainWrite;
        _record(
          MemberWriteResult(
            action,
            _uncertain
                ? MemberWriteOutcome.uncertain
                : MemberWriteOutcome.failed,
            userId: userId,
            error: error,
          ),
        );
        // A member/user 404 does not prove the team is missing. Remove stale
        // member data and force a fresh read before allowing further mutations.
        if (_notFound(error)) {
          _state = AsyncState(error: error);
        }
      }
    } finally {
      if (_writes.isCurrent(generation)) {
        _submitting = false;
        notifyListeners();
      }
    }
  }

  static const uncertainGuidance = '操作结果待确认。请先刷新并核对服务器状态；确认后再解锁其他操作，请勿直接重复提交。';
  void _notifyChanges(MemberWriteAction action) {
    final scope = action == MemberWriteAction.profile ? null : teamId;
    _changes?.emit(ResourceKind.teams, teamId: scope);
    _changes?.emit(ResourceKind.members, teamId: scope);
    if (action == MemberWriteAction.remove) {
      _changes?.emit(ResourceKind.matches, teamId: teamId);
    }
  }

  /// Operator verification only. A confirmed applied action becomes a success,
  /// allowing forms to close without replay; a confirmed unapplied action can
  /// be attempted again explicitly. Neither branch repeats a write request.
  void acknowledgeOutcomeChecked({required bool applied}) {
    if (_disposed || _submitting || !_uncertain) return;
    final previous = _lastResult!;
    _uncertain = false;
    _record(
      MemberWriteResult(
        previous.action,
        applied ? MemberWriteOutcome.succeeded : MemberWriteOutcome.failed,
        userId: previous.userId,
        error: applied
            ? null
            : const ApiError(
                message: '已核实未生效，可重新选择并操作',
                kind: ApiErrorKind.business,
              ),
      ),
    );
    if (applied) {
      _submitting = true;
      _notifyChanges(previous.action);
      unawaited(_refreshChecked());
    }
    notifyListeners();
  }

  Future<void> _refreshChecked() async {
    await _load();
    if (!_disposed) {
      _submitting = false;
      notifyListeners();
    }
  }

  static bool _notFound(Object error) =>
      error is ApiError && (error.httpStatus == 404 || error.code == 404);
  @override
  void dispose() {
    _disposed = true;
    unawaited(_subscription?.cancel());
    _reads.dispose();
    _searches.dispose();
    _writes.dispose();
    super.dispose();
  }
}
