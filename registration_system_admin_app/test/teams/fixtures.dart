import 'package:registration_system_admin_app/features/teams/domain/team.dart';

Map<String, Object?> teamJson({
  int id = 42,
  String name = '星河队',
  String status = 'active',
  bool list = true,
}) => {
  'id': id,
  'name': name,
  'description': null,
  'logo_url': null,
  'captain_id': null,
  'captain': null,
  'status': status,
  'created_at': '2026-10-02T23:00:00Z',
  'updated_at': '2026-10-03T00:00:00Z',
  if (list) 'member_count': 12,
};
Team team({int id = 42, String name = '星河队', String status = 'active'}) => Team(
  id: id,
  name: name,
  status: status,
  memberCount: 12,
  createdAt: DateTime.utc(2026, 10, 2, 23),
  updatedAt: DateTime.utc(2026, 10, 3),
);
