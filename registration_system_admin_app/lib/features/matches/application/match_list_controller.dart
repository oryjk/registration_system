import 'package:flutter/foundation.dart';
import '../../../core/state/async_state.dart';
import '../../../core/state/request_controller.dart';
import '../domain/match_repository.dart';

class MatchListController extends ChangeNotifier {
  MatchListController({required MatchRepository repository, int pageSize = 20})
    : _repository = repository,
      _query = MatchQuery(pageSize: pageSize.clamp(1, 100));
  final MatchRepository _repository;
  final _requests = RequestController();
  bool _disposed = false, _loadingMore = false;
  AsyncState<MatchPage> _state = const AsyncState();
  AsyncState<MatchPage> get state => _state;
  MatchQuery _query;
  MatchQuery get query => _query;
  bool get loadingMore => _loadingMore;
  bool get hasMore => _state.data?.hasMore ?? false;

  /// Omitted arguments preserve the filter; an empty status clears it.
  Future<void> setFilter({String? search, String? status}) {
    if (_disposed) return Future.value();
    _query = MatchQuery(
      search: (search ?? _query.search).trim(),
      status: status == null
          ? _query.status
          : status.trim().isEmpty
          ? null
          : status.trim(),
      pageSize: _query.pageSize,
    );
    _state = const AsyncState();
    return refresh();
  }

  Future<void> refresh() async {
    if (_disposed) return;
    final generation = _requests.begin();
    _loadingMore = false;
    final q = MatchQuery(
      search: _query.search,
      status: _query.status,
      pageSize: _query.pageSize,
    );
    _state = _state.startLoading();
    notifyListeners();
    try {
      final result = await _repository.list(q);
      if (!_requests.isCurrent(generation)) return;
      _query = MatchQuery(
        search: q.search,
        status: q.status,
        page: result.page,
        pageSize: result.pageSize,
      );
      _state = _state.succeeded(_deduplicate(result));
    } catch (error) {
      if (_requests.isCurrent(generation)) _state = _state.failed(error);
    }
    if (_requests.isCurrent(generation)) notifyListeners();
  }

  Future<void> loadMore() async {
    final prior = _state.data;
    if (_disposed ||
        _loadingMore ||
        _state.loading ||
        _state.refreshing ||
        prior == null ||
        !prior.hasMore) {
      return;
    }
    final generation = _requests.begin();
    _loadingMore = true;
    final q = MatchQuery(
      search: _query.search,
      status: _query.status,
      page: prior.page + 1,
      pageSize: _query.pageSize,
    );
    _state = _state.succeeded(prior);
    notifyListeners();
    try {
      final result = await _repository.list(q);
      if (!_requests.isCurrent(generation)) return;
      _query = MatchQuery(
        search: q.search,
        status: q.status,
        page: result.page,
        pageSize: result.pageSize,
      );
      _state = _state.succeeded(_deduplicate(result, before: prior.items));
    } catch (error) {
      if (_requests.isCurrent(generation)) _state = _state.failed(error);
    }
    if (_requests.isCurrent(generation)) {
      _loadingMore = false;
      notifyListeners();
    }
  }

  MatchPage _deduplicate(
    MatchPage result, {
    List<MatchItem> before = const [],
  }) {
    final items = <String, MatchItem>{
      for (final item in [...before, ...result.items]) item.id: item,
    };
    return MatchPage(
      items: items.values.toList(),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    );
  }

  @override
  void dispose() {
    _disposed = true;
    _requests.dispose();
    super.dispose();
  }
}
