import 'match_draft.dart';
import 'match_models.dart';
export 'match_draft.dart';
export 'match_models.dart';

abstract interface class MatchRepository {
  Future<MatchPage> list(MatchQuery query);
  Future<MatchDetail> get(String id);
  Future<MatchDetail> create(MatchDraft draft);
  Future<MatchDetail> update(String id, MatchDraft draft);
  Future<MatchDetail> setStatus(String id, String status);
  Future<MatchDetail> setScore(String id, int hostScore, int awayScore);
  Future<void> delete(String id);
}
