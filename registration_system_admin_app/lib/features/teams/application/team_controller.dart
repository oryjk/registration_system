import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../../core/network/api_error.dart';
import '../../../core/state/async_state.dart';
import '../../../core/state/request_controller.dart';
import '../../../core/state/resource_changes.dart';
import '../domain/team_repository.dart';

enum TeamWriteAction { save, delete, password }

/// Borrowed by pages. Its creator owns disposal (including resource subscription).
/// Use separate instances for list/detail/form routes; ResourceChanges coordinates
/// them. Writes emit once; reads never emit. Outcome flags describe the write,
/// while state/detailState.error describe independently retryable reads.
class TeamController extends ChangeNotifier {
  TeamController({
    required TeamRepository repository,
    ResourceChanges? changes,
    Team? initialTeam,
  }) : _repository = repository,
       _changes = changes,
       _detailState = AsyncState(data: initialTeam),
       _detailId = initialTeam?.id {
    _subscription = changes?.stream.listen((event) {
      if (event.kind != ResourceKind.teams || _disposed || _submitting) return;
      if (_listRequested) unawaited(refresh());
      if (_detailId != null &&
          (event.teamId == null || event.teamId == _detailId)) {
        unawaited(load(_detailId!));
      }
    });
  }
  final TeamRepository _repository;
  final ResourceChanges? _changes;
  StreamSubscription<ResourceChange>? _subscription;
  final _listRequests = RequestController(),
      _detailRequests = RequestController(),
      _writes = RequestController();
  bool _disposed = false, _listRequested = false;
  AsyncState<List<Team>> _state = const AsyncState();
  AsyncState<Team> _detailState;
  AsyncState<List<Team>> get state => _state;
  AsyncState<Team> get detailState => _detailState;
  String? _status;
  String _search = '';
  String? get status => _status;
  String get search => _search;
  List<Team> get filteredTeams => List.unmodifiable(
    (_state.data ?? const <Team>[]).where(
      (t) => t.name.toLowerCase().contains(_search.toLowerCase()),
    ),
  );
  int? _detailId, _deletedId;
  bool _missing = false,
      _submitting = false,
      _writeSucceeded = false,
      _writeOutcomeUncertain = false;
  bool get missing => _missing;
  bool get submitting => _submitting;
  bool get writeSucceeded => _writeSucceeded;
  bool get writeOutcomeUncertain => _writeOutcomeUncertain;
  int? get deletedId => _deletedId;
  Object? _writeError;
  Object? get writeError => _writeError;
  Team? _savedTeam;
  Team? get savedTeam => _savedTeam;
  TeamWriteAction? _writeAction;
  TeamWriteAction? get writeAction => _writeAction;
  Map<String, String> _fieldErrors = const {};
  Map<String, String> get fieldErrors => _fieldErrors;
  static const uncertainGuidance =
      '操作结果待核实，请先检查球队列表或详情，勿重复提交。入队密码不返回明文，需向球队负责人核实是否生效。';
  bool get _locked => _disposed || _submitting || _writeOutcomeUncertain;

  void setSearch(String search) {
    if (_disposed) return;
    _search = search.trim();
    notifyListeners();
  }

  /// Omission preserves status; empty string clears it. Search never hits HTTP.
  Future<void> refresh({String? status}) async {
    if (_disposed || _submitting) return;
    if (status != null) {
      final next = status.trim().isEmpty ? null : status;
      if (next != _status) _state = const AsyncState();
      _status = next;
    }
    _listRequested = true;
    await _refreshList();
  }

  Future<void> _refreshList() async {
    final generation = _listRequests.begin();
    final requestedStatus = _status;
    _state = _state.startLoading();
    notifyListeners();
    try {
      final teams = await _repository.list(status: requestedStatus);
      if (_listRequests.isCurrent(generation)) {
        _state = _state.succeeded(List.unmodifiable(teams));
      }
    } catch (error) {
      if (_listRequests.isCurrent(generation)) _state = _state.failed(error);
    }
    if (_listRequests.isCurrent(generation)) notifyListeners();
  }

  Future<void> load(int id) async {
    if (_disposed || _submitting || _deletedId == id) return;
    if (_detailId != id) _detailState = const AsyncState();
    _detailId = id;
    await _loadDetail(id);
  }

  Future<void> _loadDetail(int id) async {
    final generation = _detailRequests.begin();
    _detailState = _detailState.startLoading();
    notifyListeners();
    try {
      final team = await _repository.get(id);
      if (_detailRequests.isCurrent(generation)) {
        _detailState = _detailState.succeeded(team);
        _missing = false;
      }
    } catch (error) {
      if (_detailRequests.isCurrent(generation)) {
        _missing = _isMissing(error);
        _detailState = _missing
            ? AsyncState(error: error)
            : _detailState.failed(error);
      }
    }
    if (_detailRequests.isCurrent(generation)) notifyListeners();
  }

  Team? _team(int id) {
    if (_detailState.data?.id == id) return _detailState.data;
    for (final team in _state.data ?? const <Team>[]) {
      if (team.id == id) return team;
    }
    return null;
  }

  bool canManage(int id) =>
      !_locked &&
      !_missing &&
      _deletedId != id &&
      (_team(id)?.canManage ?? false);

  Future<void> save(TeamDraft draft, {int? id}) async {
    if (_locked || _writeSucceeded) return;
    final errors = draft.validate();
    if (id != null && draft.status == null) errors['status'] = '编辑时请选择球队状态';
    if (id == null && draft.status != null) {
      errors['status'] = '新球队默认启用，请重新打开创建表单';
    }
    if (id != null && !canManage(id)) errors['team'] = '球队不存在或当前状态不支持修改，请刷新详情';
    _fieldErrors = Map.unmodifiable(errors);
    if (errors.isNotEmpty) {
      notifyListeners();
      return;
    }
    await _write(
      TeamWriteAction.save,
      id,
      () async => id == null
          ? _repository.create(draft)
          : _repository.update(id, draft),
    );
  }

  Future<void> delete(int id) async {
    if (_locked) return;
    if (!canManage(id)) {
      _reject('当前球队不支持删除，请刷新详情');
      return;
    }
    await _write(TeamWriteAction.delete, id, () async {
      await _repository.delete(id);
      return null;
    });
  }

  Future<void> setJoinPassword(int id, String password) async {
    if (_locked) return;
    if (!canManage(id)) {
      _reject('当前球队不支持设置入队密码，请刷新详情');
      return;
    }
    await _write(TeamWriteAction.password, id, () async {
      await _repository.setJoinPassword(id, password);
      return null;
    });
  }

  void _reject(String message) {
    _writeSucceeded = false;
    _writeError = ApiError(message: message, kind: ApiErrorKind.validation);
    notifyListeners();
  }

  Future<void> _write(
    TeamWriteAction action,
    int? id,
    Future<Team?> Function() request,
  ) async {
    final generation = _writes.begin();
    _listRequests.invalidate();
    _detailRequests.invalidate();
    _submitting = true;
    _writeSucceeded = false;
    _writeError = null;
    _savedTeam = null;
    _writeAction = action;
    _fieldErrors = const {};
    _state = AsyncState(data: _state.data);
    _detailState = AsyncState(data: _detailState.data);
    notifyListeners();
    try {
      final team = await request();
      if (!_writes.isCurrent(generation)) return;
      _writeSucceeded = true;
      _savedTeam = team;
      if (team != null) {
        _detailId = team.id;
        _detailState = AsyncState(data: team);
      }
      if (action == TeamWriteAction.delete) {
        _deletedId = id;
        _detailState = const AsyncState();
      }
      _changes?.emit(ResourceKind.teams, teamId: id ?? team?.id);
      notifyListeners();
      if (_listRequested) await _refreshList();
      if (action == TeamWriteAction.password &&
          _detailId != null &&
          !_disposed) {
        await _loadDetail(_detailId!);
      }
    } catch (error) {
      if (_writes.isCurrent(generation)) {
        _writeError = error;
        _writeOutcomeUncertain = error is ApiError && error.uncertainWrite;
        if (_isMissing(error) && id != null) {
          _missing = true;
          _detailState = AsyncState(error: error);
          if (_state.data != null) {
            _state = AsyncState(
              data: _state.data!.where((t) => t.id != id).toList(),
            );
          }
          _changes?.emit(ResourceKind.teams, teamId: id);
        }
      }
    } finally {
      if (_writes.isCurrent(generation)) {
        _submitting = false;
        notifyListeners();
      }
    }
  }

  /// Explicit operator acknowledgement only; reads cannot verify a password or
  /// identify an uncertain creation. No automatic retry/unlock is performed.
  void acknowledgeOutcomeChecked() {
    if (_disposed || _submitting || !_writeOutcomeUncertain) return;
    _writeOutcomeUncertain = false;
    _writeError = null;
    notifyListeners();
  }

  static bool _isMissing(Object error) =>
      error is ApiError &&
      (error.httpStatus == 404 ||
          (error.httpStatus != null &&
              error.httpStatus! >= 200 &&
              error.httpStatus! < 300 &&
              error.code == 404));
  @override
  void dispose() {
    _disposed = true;
    unawaited(_subscription?.cancel());
    _listRequests.dispose();
    _detailRequests.dispose();
    _writes.dispose();
    super.dispose();
  }
}
