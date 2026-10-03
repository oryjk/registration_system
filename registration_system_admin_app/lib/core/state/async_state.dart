/// Refresh failures retain loaded data so successful writes are not repeated.
class AsyncState<T> {
  const AsyncState({
    this.data,
    this.error,
    this.loading = false,
    this.refreshing = false,
  });

  final T? data;
  final Object? error;
  final bool loading;
  final bool refreshing;

  AsyncState<T> startLoading() => AsyncState<T>(
    data: data,
    loading: data == null,
    refreshing: data != null,
  );

  AsyncState<T> succeeded(T value) => AsyncState<T>(data: value);

  AsyncState<T> failed(Object failure) =>
      AsyncState<T>(data: data, error: failure);
}
