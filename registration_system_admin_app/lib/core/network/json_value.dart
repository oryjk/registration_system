import 'api_error.dart';

/// Repository decoders reject unexpected wire types rather than coercing them.
abstract final class JsonValue {
  static Map<String, Object?> object(Object? value) {
    if (value is! Map || value.keys.any((key) => key is! String)) {
      throw _invalid();
    }
    return Map<String, Object?>.from(value);
  }

  static List<Object?> array(Object? value) {
    if (value is! List) throw _invalid();
    return List<Object?>.from(value);
  }

  static num number(Object? value) {
    if (value is! num || !value.isFinite) throw _invalid();
    return value;
  }

  static int integer(Object? value) {
    if (value is! int) throw _invalid();
    return value;
  }

  static String string(Object? value) {
    if (value is! String) throw _invalid();
    return value;
  }

  static bool boolean(Object? value) {
    if (value is! bool) throw _invalid();
    return value;
  }

  static T? nullable<T>(Object? value, T Function(Object?) decoder) =>
      value == null ? null : decode(value, decoder);

  /// Wrap the entire repository conversion, including casts/date parsing, so
  /// malformed server data cannot escape as a TypeError or FormatException.
  /// Writes that already received success can still have malformed data; their
  /// repositories pass [uncertainWrite] so callers retain pending confirmation.
  static T decode<T>(
    Object? value,
    T Function(Object?) decoder, {
    bool uncertainWrite = false,
  }) {
    try {
      return decoder(value);
    } on ApiError catch (error) {
      if (uncertainWrite && error.kind == ApiErrorKind.protocol) {
        throw ApiError(
          message: error.message,
          kind: error.kind,
          httpStatus: error.httpStatus,
          code: error.code,
          uncertainWrite: true,
        );
      }
      rethrow;
    } on Object {
      throw _invalid(uncertainWrite: uncertainWrite);
    }
  }

  static ApiError _invalid({bool uncertainWrite = false}) => ApiError(
    message: '服务器返回的数据格式有误，请稍后重试',
    kind: ApiErrorKind.protocol,
    uncertainWrite: uncertainWrite,
  );
}
