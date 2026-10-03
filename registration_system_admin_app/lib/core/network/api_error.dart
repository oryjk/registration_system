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
    this.authoritativeValidation = false,
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

  /// A complete Go HTTP 422 envelope, rather than a proxy/status-only rejection.
  final bool authoritativeValidation;

  @override
  String toString() => message;
}
