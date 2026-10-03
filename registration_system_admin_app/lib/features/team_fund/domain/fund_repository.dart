import 'fund_models.dart';

abstract interface class FundRepository {
  Future<FundResult> execute(PendingFundAction action);
  Future<List<FundTransaction>> transactions(
    int teamId,
    int userId, {
    int beforeId = 0,
    int limit = 30,
  });
}

abstract interface class PendingFundStore {
  Future<PendingFundAction?> read(FundScope scope);
  Future<void> save(PendingFundAction action);
  Future<void> remove(FundScope scope, {String? expectedKey});
}
