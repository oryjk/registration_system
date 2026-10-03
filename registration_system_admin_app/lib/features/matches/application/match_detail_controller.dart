import 'package:flutter/foundation.dart';
import '../../../core/network/api_error.dart';
import '../../../core/state/async_state.dart';
import '../../../core/state/request_controller.dart';
import '../../../core/state/resource_changes.dart';
import '../domain/match_repository.dart';

class MatchDetailController extends ChangeNotifier {
  MatchDetailController({
    required MatchRepository repository,
    required this.id,
    this.isSuperAdmin = false,
    ResourceChanges? changes,
  }) : _repository = repository,
       _changes = changes;
  final MatchRepository _repository;
  final ResourceChanges? _changes;
  final String id;
  final bool isSuperAdmin;
  final _requests = RequestController();
  bool _disposed = false, _uncertainDelete = false;
  AsyncState<MatchDetail> _state = const AsyncState();
  AsyncState<MatchDetail> get state => _state;
  bool _submitting = false,
      _writeSucceeded = false,
      _writeOutcomeUncertain = false,
      _deleted = false;
  Object? _writeError;
  bool get submitting => _submitting;
  bool get writeSucceeded => _writeSucceeded;
  bool get writeOutcomeUncertain => _writeOutcomeUncertain;
  bool get deleted => _deleted;
  Object? get writeError => _writeError;
  bool get canDelete => isSuperAdmin && (_state.data?.match.canDelete ?? false);
  static const uncertainGuidance = '操作结果待核实，请刷新详情确认是否已生效，勿重复操作。';
  Future<void> load() async {
    if (_disposed || _submitting || _deleted) return;
    final generation = _requests.begin();
    _state = _state.startLoading();
    notifyListeners();
    try {
      final result = await _repository.get(id);
      if (!_requests.isCurrent(generation)) return;
      _state = _state.succeeded(result);
      // A successful read provides the actual current state for a new decision.
      _writeOutcomeUncertain = false;
      _writeError = null;
      _uncertainDelete = false;
    } catch (error) {
      if (_requests.isCurrent(generation)) {
        final notFound =
            error is ApiError &&
            (error.httpStatus == 404 ||
                (error.httpStatus != null &&
                    error.httpStatus! >= 200 &&
                    error.httpStatus! < 300 &&
                    error.code == 404));
        if (_uncertainDelete && notFound) {
          _deleted = true;
          _writeSucceeded = true;
          _writeOutcomeUncertain = false;
          _writeError = null;
          _uncertainDelete = false;
          _state = AsyncState(data: _state.data);
          _changes?.emit(ResourceKind.matches);
        } else {
          _state = _state.failed(error);
        }
      }
    }
    if (_requests.isCurrent(generation)) notifyListeners();
  }

  bool get _locked =>
      _disposed || _submitting || _deleted || _writeOutcomeUncertain;
  Future<void> changeStatus(String status) {
    if (_locked) return Future.value();
    if (!(_state.data?.match.allowedNextStatuses.contains(status) ?? false)) {
      return _reject('比赛状态不能这样变更');
    }
    return _write(() => _repository.setStatus(id, status));
  }

  Future<void> saveScore(int hostScore, int awayScore) {
    if (_locked) return Future.value();
    if (!(_state.data?.match.canRecordScore ?? false)) {
      return _reject('比赛开始后才能录入比分');
    }
    if (hostScore < 0 || hostScore > 999 || awayScore < 0 || awayScore > 999) {
      return _reject('比分必须在 0 到 999 之间');
    }
    return _write(() => _repository.setScore(id, hostScore, awayScore));
  }

  Future<void> delete() {
    if (_locked) return Future.value();
    if (!canDelete) return _reject('当前账号或比赛不允许删除');
    return _write(() async {
      await _repository.delete(id);
      return null;
    }, deleting: true);
  }

  Future<void> _reject(String message) {
    _writeSucceeded = false;
    _writeError = ApiError(message: message, kind: ApiErrorKind.validation);
    notifyListeners();
    return Future.value();
  }

  Future<void> _write(
    Future<MatchDetail?> Function() action, {
    bool deleting = false,
  }) async {
    final generation = _requests.begin();
    _submitting = true;
    _writeSucceeded = false;
    _writeError = null;
    // Invalidate any older read, retaining loaded detail while this write runs.
    _state = AsyncState(data: _state.data);
    notifyListeners();
    try {
      final result = await action();
      if (!_requests.isCurrent(generation)) return;
      if (result != null) _state = _state.succeeded(result);
      _deleted = deleting;
      _writeSucceeded = true;
      _changes?.emit(ResourceKind.matches);
    } catch (error) {
      if (_requests.isCurrent(generation)) {
        _writeError = error;
        _writeOutcomeUncertain = error is ApiError && error.uncertainWrite;
        _uncertainDelete = deleting && _writeOutcomeUncertain;
      }
    } finally {
      if (_requests.isCurrent(generation)) {
        _submitting = false;
        notifyListeners();
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _requests.dispose();
    super.dispose();
  }
}
