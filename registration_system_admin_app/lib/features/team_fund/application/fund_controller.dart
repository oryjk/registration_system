import 'dart:math';
import 'package:flutter/foundation.dart';
import '../../../core/state/request_controller.dart';
import '../../../core/state/resource_changes.dart';
import '../domain/fund_models.dart';
import '../domain/fund_repository.dart';

enum FundPhase { idle, submitting, pending, confirmed, error }

class FundState {
  const FundState({
    this.phase = FundPhase.idle,
    this.pending,
    this.result,
    this.error,
  });
  final FundPhase phase;
  final PendingFundAction? pending;
  final FundResult? result;
  final Object? error;
}

/// Borrowed by pages; composition disposes it on account teardown. Every storage
/// await is followed by a currency check before dispatching a protected write.
class FundController extends ChangeNotifier {
  FundController({
    required this.scope,
    required FundRepository repository,
    required PendingFundStore store,
    bool Function()? isCurrent,
    ResourceChanges? changes,
  }) : _repository = repository,
       _store = store,
       _isCurrent = isCurrent ?? (() => true),
       _changes = changes;
  final FundScope scope;
  final FundRepository _repository;
  final PendingFundStore _store;
  final bool Function() _isCurrent;
  final ResourceChanges? _changes;
  final _writes = RequestController(), _reads = RequestController();
  bool _disposed = false, _busy = false, _restored = false;
  FundState _state = const FundState();
  FundState get state => _state;
  FundPhase get phase => _state.phase;
  PendingFundAction? get pending => _state.pending;
  FundResult? get result => _state.result;
  int? _balanceCents;
  int? get balanceCents => _balanceCents;
  Object? get error => _state.error;
  bool get submitting => _busy;
  bool get ready => _restored && !_busy && pending == null && _active;
  bool get _active => !_disposed && _isCurrent();
  List<FundTransaction> _transactions = const [];
  List<FundTransaction> get transactions => _transactions;
  Object? transactionsError;
  bool loadingTransactions = false, hasMoreTransactions = true;
  int _cursor = 0;
  Map<String, String> fieldErrors = const {};

  bool _current(int generation) => _active && _writes.isCurrent(generation);
  void _publish(FundState value) {
    if (!_active) return;
    _state = value;
    notifyListeners();
  }

  Future<void> restore() async {
    if (!_active || _busy || _restored) return;
    final generation = _writes.begin();
    _busy = true;
    notifyListeners();
    try {
      final saved = await _store.read(scope);
      if (!_current(generation)) return;
      _restored = true;
      _state = FundState(
        phase: saved == null ? FundPhase.idle : FundPhase.pending,
        pending: saved,
      );
    } catch (e) {
      if (_current(generation)) {
        _state = FundState(
          phase: FundPhase.error,
          error: e,
          pending: pending,
          result: result,
        );
      }
    } finally {
      if (_current(generation)) {
        _busy = false;
        notifyListeners();
      }
    }
  }

  Future<void> submit(FundDraft draft) async {
    if (!_active || _busy || pending != null) return;
    fieldErrors = draft.validate();
    if (draft.action == FundAction.reversal &&
        (loadingTransactions ||
            transactionsError != null ||
            !_transactions.any(
              (t) =>
                  t.id == draft.originalTransactionId &&
                  t.teamId == scope.teamId &&
                  t.canReverse,
            ))) {
      fieldErrors = {...fieldErrors, 'original': '原流水状态已变化，请刷新流水后核实'};
    }
    if (fieldErrors.isNotEmpty) {
      _publish(
        FundState(phase: FundPhase.error, error: fieldErrors.values.first),
      );
      return;
    }
    final generation = _writes.begin();
    _busy = true;
    _reads.invalidate();
    loadingTransactions = false;
    _publish(const FundState(phase: FundPhase.submitting));
    try {
      final existing = await _store.read(scope);
      if (!_current(generation)) return;
      _restored = true;
      if (existing != null) {
        _state = FundState(phase: FundPhase.pending, pending: existing);
        return;
      }
      final action = PendingFundAction(
        scope: scope,
        draft: draft,
        key: _uuid(),
        createdAt: DateTime.now().toUtc(),
      );
      await _store.save(action);
      if (!_current(generation)) return;
      // Only persisted actions can reach the network. A partial storage failure
      // is recovered by reading before any subsequent submit, never overwritten.
      _state = FundState(phase: FundPhase.submitting, pending: action);
      await _execute(action, generation);
    } catch (e) {
      if (_current(generation)) {
        if (pending == null) _restored = false;
        _state = FundState(
          phase: pending == null ? FundPhase.error : FundPhase.pending,
          error: e,
          pending: pending,
          result: result,
        );
      }
    } finally {
      if (_current(generation)) {
        _busy = false;
        notifyListeners();
      }
    }
  }

  Future<void> retryPending() async {
    final action = pending;
    if (!_active || _busy || action == null) return;
    final generation = _writes.begin();
    _busy = true;
    _reads.invalidate();
    loadingTransactions = false;
    _publish(
      FundState(phase: FundPhase.submitting, pending: action, result: result),
    );
    try {
      // Also guards the partial-delete/new-action race: save refuses another key.
      await _store.save(action);
      if (!_current(generation)) return;
      await _execute(action, generation);
    } catch (e) {
      if (_current(generation)) {
        _state = FundState(
          phase: FundPhase.pending,
          pending: action,
          result: result,
          error: e,
        );
      }
    } finally {
      if (_current(generation)) {
        _busy = false;
        notifyListeners();
      }
    }
  }

  Future<void> _execute(PendingFundAction action, int generation) async {
    final confirmed = await _repository.execute(action);
    if (!_current(generation)) return;
    _balanceCents = confirmed.balanceCents;
    _state = FundState(
      phase: FundPhase.confirmed,
      pending: action,
      result: confirmed,
    );
    _changes?.emit(ResourceKind.members, teamId: scope.teamId);
    _changes?.emit(ResourceKind.teams, teamId: scope.teamId);
    notifyListeners();
    try {
      await _store.remove(scope, expectedKey: action.key);
      if (!_current(generation)) return;
      _state = FundState(phase: FundPhase.confirmed, result: confirmed);
    } catch (e) {
      if (!_current(generation)) return;
      _state = FundState(
        phase: FundPhase.pending,
        pending: action,
        result: confirmed,
        error: e,
      );
    }
    // Success remains success if this separate read fails. Its retry is GET only.
    await refreshTransactions();
  }

  Future<void> refreshTransactions() async {
    if (!_active) return;
    _reads.invalidate();
    _cursor = 0;
    hasMoreTransactions = true;
    await _readTransactions(reset: true);
  }

  Future<void> loadMoreTransactions() async {
    if (!_active || _busy || loadingTransactions || !hasMoreTransactions) {
      return;
    }
    await _readTransactions(reset: false);
  }

  Future<void> _readTransactions({required bool reset}) async {
    final generation = _reads.begin();
    final cursor = reset ? 0 : _cursor;
    loadingTransactions = true;
    transactionsError = null;
    notifyListeners();
    try {
      final page = await _repository.transactions(
        scope.teamId,
        scope.userId,
        beforeId: cursor,
      );
      if (!_active || !_reads.isCurrent(generation)) return;
      final valid = page
          .where(
            (t) => t.teamId == scope.teamId && (cursor == 0 || t.id < cursor),
          )
          .toList();
      final all = <int, FundTransaction>{
        if (!reset)
          for (final t in _transactions) t.id: t,
        for (final t in valid) t.id: t,
      };
      _transactions = List.unmodifiable(
        all.values.toList()..sort((a, b) => b.id.compareTo(a.id)),
      );
      if (valid.isNotEmpty) _cursor = valid.map((t) => t.id).reduce(min);
      if (reset && valid.isNotEmpty) {
        final latest = valid.reduce((a, b) => a.id > b.id ? a : b);
        _balanceCents = latest.balanceAfterCents;
      }
      hasMoreTransactions = page.length >= 30 && valid.isNotEmpty;
    } catch (e) {
      if (_active && _reads.isCurrent(generation)) transactionsError = e;
    } finally {
      if (_active && _reads.isCurrent(generation)) {
        loadingTransactions = false;
        notifyListeners();
      }
    }
  }

  bool canReverse(FundTransaction transaction) =>
      ready &&
      !loadingTransactions &&
      transactionsError == null &&
      transaction.teamId == scope.teamId &&
      transaction.canReverse &&
      _transactions.any((t) => t.id == transaction.id && t.canReverse);
  static String _uuid() {
    final random = Random.secure(),
        bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }

  @override
  void dispose() {
    _disposed = true;
    _writes.dispose();
    _reads.dispose();
    super.dispose();
  }
}
