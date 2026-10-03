import 'package:flutter/foundation.dart';
import '../../../core/network/api_error.dart';
import '../../../core/state/async_state.dart';
import '../../../core/state/request_controller.dart';
import '../../../core/state/resource_changes.dart';
import '../domain/match_repository.dart';

class MatchFormController extends ChangeNotifier {
  MatchFormController({
    required MatchRepository repository,
    this.id,
    ResourceChanges? changes,
  }) : _repository = repository,
       _changes = changes;
  final MatchRepository _repository;
  final ResourceChanges? _changes;
  final String? id;
  final _requests = RequestController();
  bool _disposed = false;
  bool _submitting = false,
      _writeSucceeded = false,
      _writeOutcomeUncertain = false;
  bool get submitting => _submitting;
  bool get writeSucceeded => _writeSucceeded;
  bool get writeOutcomeUncertain => _writeOutcomeUncertain;
  AsyncState<MatchDetail> _state = const AsyncState();
  AsyncState<MatchDetail> get state => _state;
  Object? get error => _state.error;
  Map<String, String> _fieldErrors = const {};
  Map<String, String> get fieldErrors => _fieldErrors;
  static const uncertainGuidance = '提交结果待核实，请先查看比赛列表或详情确认是否已生效，勿重复提交。';
  Future<MatchDetail?> save(MatchDraft draft) async {
    if (_disposed || _submitting || _writeSucceeded || _writeOutcomeUncertain) {
      return null;
    }
    final errors = draft.validate();
    if ((id == null && draft.isEditing) ||
        (id != null && draft.original?.match.id != id)) {
      errors['match'] = '表单与比赛详情不一致，请重新打开';
    }
    _fieldErrors = Map.unmodifiable(errors);
    if (errors.isNotEmpty) {
      notifyListeners();
      return null;
    }
    final generation = _requests.begin();
    _submitting = true;
    _state = _state.startLoading();
    notifyListeners();
    try {
      final result = id == null
          ? await _repository.create(draft)
          : await _repository.update(id!, draft);
      if (!_requests.isCurrent(generation)) return null;
      _state = _state.succeeded(result);
      _writeSucceeded = true;
      _changes?.emit(ResourceKind.matches);
      return result;
    } catch (error) {
      if (_requests.isCurrent(generation)) {
        _state = _state.failed(error);
        _writeOutcomeUncertain = error is ApiError && error.uncertainWrite;
      }
      return null;
    } finally {
      if (_requests.isCurrent(generation)) {
        _submitting = false;
        notifyListeners();
      }
    }
  }

  /// UI offers this only after the operator checked the actual list/detail.
  /// If already applied, leave the form; use this only after confirming no write.
  void acknowledgeOutcomeChecked() {
    if (_disposed || _submitting || _writeSucceeded) return;
    _writeOutcomeUncertain = false;
    _state = const AsyncState();
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _requests.dispose();
    super.dispose();
  }
}
