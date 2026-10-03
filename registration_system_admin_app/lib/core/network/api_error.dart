enum ApiErrorKind {
  unauthorized,
  forbidden,
  validation,
  conflict,
  server,
  business,
  protocol,
  network,
  timeout,
}

class ApiError implements Exception {
  const ApiError({
    required this.message,
    required this.kind,
    this.httpStatus,
    this.code,
    this.uncertainWrite = false,
  });

  final String message;

  /// Null when no HTTP response arrived (or during repository conversion).
  final int? httpStatus;

  /// Preserved from the envelope even when it differs from [httpStatus].
  final int? code;
  final ApiErrorKind kind;

  /// The caller must confirm the outcome before considering another write.
  /// This is not permission to retry the request.
  final bool uncertainWrite;

  @override
  String toString() => message;
}
