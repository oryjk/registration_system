import '../domain/team_draft.dart';

abstract final class TeamPayloadMapper {
  static Map<String, Object?> toJson(TeamDraft draft) => {
    'name': draft.name.trim(),
    'description': draft.description?.trim().isEmpty != false
        ? null
        : draft.description!.trim(),
    if (draft.status != null) 'status': draft.status,
  };
}
