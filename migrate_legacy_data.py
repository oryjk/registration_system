#!/usr/bin/env python3
"""
从旧 MySQL 库迁移数据到新的 PostgreSQL 库。

默认流程：
1. 清空新库测试数据
2. 导入用户
3. 导入球队
4. 导入球队成员
5. 导入活动
6. 导入报名记录和日志
7. 导入基础账务数据

说明：
- 旧库存在 3 组重复 open_id，迁移时按 open_id 去重。
- 所有旧库人员都会加入球队「东安洺悦联队」。
- 默认把旧库的单一球队也保留导入，便于对账和历史回看。
"""

from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any, Iterable

import pymysql
import psycopg2
from psycopg2 import sql
from psycopg2.extras import execute_batch


DEFAULT_MYSQL_HOST = os.getenv("MYSQL_HOST", "117.72.164.211")
DEFAULT_MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
DEFAULT_MYSQL_USER = os.getenv("MYSQL_USER", "root")
DEFAULT_MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "beifa888")
DEFAULT_MYSQL_DB = os.getenv("MYSQL_DATABASE", "registration_system")

DEFAULT_PG_DSN = os.getenv(
    "PG_DSN",
    "postgresql://football_app:IgrfuwpVPSIu_G1jo3zeIGGuXOBo7-JI@117.72.164.211:5432/registration_system?sslmode=disable",
)

TARGET_TEAM_ID = os.getenv("TARGET_TEAM_ID", "dong-an-ming-yue")
TARGET_TEAM_NAME = os.getenv("TARGET_TEAM_NAME", "东安洺悦联队")
TARGET_TEAM_DESC = os.getenv("TARGET_TEAM_DESC", "旧库人员导入后的默认球队")
TARGET_TEAM_LOGO = os.getenv("TARGET_TEAM_LOGO") or None


RESET_TABLES = [
    "rs_team_credit_transactions",
    "rs_activity_team_reviews",
    "rs_team_membership_orders",
    "rs_activity_team_checkin_configs",
    "rs_activity_checkins",
    "rs_activity_settlement_batches",
    "rs_challenge_individual_acceptances",
    "rs_challenges",
    "rs_user_notifications",
    "rs_payment_orders",
    "rs_user_billings",
    "rs_monthly_penalties",
    "rs_recharge_records",
    "rs_user_balance_adjustments",
    "rs_user_monthly_balance",
    "rs_activity_order",
    "rs_user_activity",
    "rs_registration_log",
    "rs_team_members",
    "rs_admin_team_assignment",
    "rs_teams",
    "rs_activity",
    "rs_user_accounts",
    "rs_team_fund_transactions",
    "rs_team_fund_account",
    "rs_user_info",
    "rs_admin_user",
]


@dataclass(frozen=True)
class Config:
    mysql_host: str
    mysql_port: int
    mysql_user: str
    mysql_password: str
    mysql_db: str
    pg_dsn: str
    dry_run: bool
    reset: bool
    import_finance: bool


def parse_args() -> Config:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="只打印流程，不执行写入")
    parser.add_argument("--skip-reset", action="store_true", help="跳过清空新库")
    parser.add_argument("--no-finance", action="store_true", help="跳过账务相关导入")
    args = parser.parse_args()
    return Config(
        mysql_host=DEFAULT_MYSQL_HOST,
        mysql_port=DEFAULT_MYSQL_PORT,
        mysql_user=DEFAULT_MYSQL_USER,
        mysql_password=DEFAULT_MYSQL_PASSWORD,
        mysql_db=DEFAULT_MYSQL_DB,
        pg_dsn=DEFAULT_PG_DSN,
        dry_run=args.dry_run,
        reset=not args.skip_reset,
        import_finance=not args.no_finance,
    )


def mysql_connect(cfg: Config):
    return pymysql.connect(
        host=cfg.mysql_host,
        port=cfg.mysql_port,
        user=cfg.mysql_user,
        password=cfg.mysql_password,
        db=cfg.mysql_db,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )


def pg_connect(cfg: Config):
    return psycopg2.connect(cfg.pg_dsn)


def truncate_target_db(cur) -> None:
    cur.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = '_sqlx_migrations'")
    for table_name in RESET_TABLES:
        cur.execute(
            sql.SQL("TRUNCATE TABLE {} RESTART IDENTITY CASCADE").format(sql.Identifier(table_name))
        )


def execute_many(cur, statements: Iterable[str]) -> None:
    for statement in statements:
        cur.execute(statement)


def ensure_seed_data(cur) -> None:
    execute_many(
        cur,
        [
            """
            INSERT INTO rs_admin_user (username, password_hash, nickname, status, is_super_admin)
            SELECT 'admin',
                   '$2y$12$4A6LXSTKotlRRL4a5Xum3OarsLxRfqN8ge6aficTEjkRRW30FIplq',
                   '默认管理员',
                   1,
                   1
            WHERE NOT EXISTS (SELECT 1 FROM rs_admin_user WHERE username = 'admin')
            """,
            """
            INSERT INTO rs_team_fund_account (balance, total_income, total_expense)
            SELECT 0.00, 0.00, 0.00
            WHERE NOT EXISTS (SELECT 1 FROM rs_team_fund_account)
            """,
            """
            INSERT INTO rs_system_map_settings (
                id, selected_provider, tencent_key, tencent_secret, tencent_web_service_base_url,
                amap_key, amap_secret, amap_web_service_base_url
            )
            VALUES (
                1, 'tencent', '', '', 'https://apis.map.qq.com', '', '', 'https://restapi.amap.com'
            )
            ON CONFLICT (id) DO NOTHING
            """,
            """
            INSERT INTO rs_system_runtime_configs (config_key, config_value)
            VALUES (
                'mini_app',
                '{
                  "home": {
                    "match_card_limit": 2,
                    "challenge_card_limit": 2,
                    "activity_fetch_page_size": 100,
                    "hide_matches_after_holding_time": true
                  },
                  "matches": {
                    "related_activity_limit": 2,
                    "participant_avatar_limit": 5,
                    "capacity_extra_slots": 2
                  },
                  "checkin": {
                    "default_radius_meters": 200,
                    "default_open_minutes_before": 60,
                    "default_close_minutes_after": 45
                  },
                  "billing": {
                    "recent_order_limit": 10
                  },
                  "notifications": {
                    "list_limit": 50
                  }
                }'::jsonb
            )
            ON CONFLICT (config_key) DO NOTHING
            """,
        ],
    )


def normalize_dt(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value.strip():
        return datetime.fromisoformat(value.replace(" ", "T"))
    return None


def normalize_boolish(value: Any) -> bool:
    if isinstance(value, (bytes, bytearray)):
        return value != b"\x00"
    if isinstance(value, int):
        return value != 0
    if isinstance(value, str):
        return value not in {"", "0", "false", "False"}
    return bool(value)


def normalize_text(value: Any) -> str:
    return "" if value is None else str(value)


def truncate_text(value: Any, limit: int | None) -> str | None:
    text = normalize_text(value)
    if not text:
        return None
    if limit is None:
        return text
    return text[:limit]


def team_role_from_old(value: Any) -> str:
    if value in {"captain", "vice_captain"}:
        return str(value)
    return "member"


def clear_pycache() -> None:
    cache_dir = "__pycache__"
    if os.path.isdir(cache_dir):
        for name in os.listdir(cache_dir):
            try:
                os.remove(os.path.join(cache_dir, name))
            except OSError:
                pass


def import_users(my_cur, pg_cur, mysql_to_pg_user_id: dict[int, int]) -> None:
    my_cur.execute("SELECT * FROM rs_user_info ORDER BY id ASC")
    rows = my_cur.fetchall()

    rows_by_open_id: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        open_id = normalize_text(row["open_id"])
        if not open_id:
            continue
        rows_by_open_id.setdefault(open_id, []).append(row)

    inserted = 0
    skipped = 0

    def user_priority(row: dict[str, Any]) -> tuple[int, datetime, int]:
        latest_login_date = normalize_dt(row["latest_login_date"]) or normalize_dt(row["create_time"]) or datetime.min
        return (int(row["status"] or 0), latest_login_date, int(row["id"]))

    for open_id, duplicate_rows in rows_by_open_id.items():
        row = max(duplicate_rows, key=user_priority)
        mysql_id = int(row["id"])
        nickname = normalize_text(row["nickname"])
        real_name = normalize_text(row["real_name"])
        avatar_url = normalize_text(row["avatar_url"])
        username = normalize_text(row["username"])
        phone_number = normalize_text(row["phone_number"])
        is_manager = 1 if normalize_boolish(row["is_manager"]) else 0
        status = int(row["status"]) if row["status"] is not None else 1
        create_time = normalize_dt(row["create_time"]) or datetime.now()
        latest_login_date = normalize_dt(row["latest_login_date"]) or create_time

        pg_cur.execute(
            """
            INSERT INTO rs_user_info (
                id, open_id, union_id, username, nickname, real_name, avatar_url,
                phone_number, is_manager, status, create_time, latest_login_date,
                leave_start_time, leave_end_time
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (open_id) DO UPDATE SET
                union_id = EXCLUDED.union_id,
                username = EXCLUDED.username,
                nickname = EXCLUDED.nickname,
                real_name = EXCLUDED.real_name,
                avatar_url = CASE
                    WHEN rs_user_info.avatar_url LIKE 'http%' THEN rs_user_info.avatar_url
                    ELSE EXCLUDED.avatar_url
                END,
                phone_number = EXCLUDED.phone_number,
                is_manager = EXCLUDED.is_manager,
                status = EXCLUDED.status,
                latest_login_date = EXCLUDED.latest_login_date,
                leave_start_time = EXCLUDED.leave_start_time,
                leave_end_time = EXCLUDED.leave_end_time
            RETURNING id
            """,
            (
                mysql_id,
                truncate_text(open_id, 128),
                truncate_text(row["union_id"], 128),
                truncate_text(username, 100) or "",
                truncate_text(nickname, 100) or "",
                truncate_text(real_name, 100) or "",
                normalize_text(avatar_url),
                truncate_text(phone_number, 32) or "",
                is_manager,
                status,
                create_time,
                latest_login_date,
                normalize_dt(row["leave_start_time"]),
                normalize_dt(row["leave_end_time"]),
            ),
        )
        new_id = int(pg_cur.fetchone()[0])
        for duplicate_row in duplicate_rows:
            mysql_to_pg_user_id[int(duplicate_row["id"])] = new_id
        skipped += len(duplicate_rows) - 1
        inserted += 1

    print(f"  用户导入：新增/更新 {inserted}，跳过 {skipped}")


def ensure_target_team(pg_cur) -> str:
    pg_cur.execute(
        """
        INSERT INTO rs_teams (id, name, description, logo_url, captain_id, join_password_hash, status)
        VALUES (%s, %s, %s, %s, NULL, NULL, 1)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            logo_url = EXCLUDED.logo_url,
            status = EXCLUDED.status
        RETURNING id
        """,
        (TARGET_TEAM_ID, TARGET_TEAM_NAME, TARGET_TEAM_DESC, TARGET_TEAM_LOGO),
    )
    return str(pg_cur.fetchone()[0])


def import_teams(my_cur, pg_cur, mysql_to_pg_user_id: dict[int, int], team_id_map: dict[str, str]) -> None:
    my_cur.execute("SELECT * FROM rs_teams ORDER BY created_at ASC")
    rows = my_cur.fetchall()

    target_team_id = ensure_target_team(pg_cur)
    team_id_map["target"] = target_team_id

    inserted = 0
    for row in rows:
        old_id = normalize_text(row["id"])
        team_name = normalize_text(row["name"])
        if not old_id or not team_name:
            continue

        captain_id = row["captain_id"]
        pg_captain_id = mysql_to_pg_user_id.get(int(captain_id)) if captain_id is not None else None
        if old_id == target_team_id:
            pg_cur.execute(
                """
                UPDATE rs_teams
                SET name = %s, description = %s, logo_url = %s, captain_id = %s, status = %s
                WHERE id = %s
                """,
                (
                    truncate_text(team_name, 100),
                    truncate_text(row["description"], 500),
                    truncate_text(row["logo_url"], 500),
                    pg_captain_id,
                    int(row["status"] or 1),
                    old_id,
                ),
            )
            continue

        pg_cur.execute(
            """
            INSERT INTO rs_teams (
                id, name, description, logo_url, captain_id, join_password_hash, status, created_at, updated_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                logo_url = EXCLUDED.logo_url,
                captain_id = EXCLUDED.captain_id,
                join_password_hash = EXCLUDED.join_password_hash,
                status = EXCLUDED.status,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at
            """,
            (
                old_id,
                truncate_text(team_name, 100),
                truncate_text(row["description"], 500),
                truncate_text(row["logo_url"], 500),
                pg_captain_id,
                normalize_text(row["join_password"]) or None,
                int(row["status"] or 1),
                normalize_dt(row["created_at"]) or datetime.now(),
                normalize_dt(row["updated_at"]) or datetime.now(),
            ),
        )
        team_id_map[old_id] = old_id
        inserted += 1

    print(f"  球队导入：{inserted} 条，目标球队={target_team_id}")


def import_team_members(my_cur, pg_cur, mysql_to_pg_user_id: dict[int, int], team_id_map: dict[str, str]) -> None:
    my_cur.execute("SELECT * FROM rs_team_members ORDER BY created_at ASC, id ASC")
    rows = my_cur.fetchall()

    target_team_id = team_id_map["target"]
    inserted = 0
    seen_target_members: set[int] = set()

    for row in rows:
        old_team_id = normalize_text(row["team_id"])
        old_user_id = int(row["user_id"])
        new_user_id = mysql_to_pg_user_id.get(old_user_id)
        if new_user_id is None:
            continue

        new_team_id = team_id_map.get(old_team_id, old_team_id)
        role = team_role_from_old(row["role"])
        status = int(row["status"] or 1)
        joined_at = normalize_dt(row["joined_at"]) or datetime.now()
        created_at = normalize_dt(row["created_at"]) or joined_at
        updated_at = normalize_dt(row["updated_at"]) or created_at

        pg_cur.execute(
            """
            INSERT INTO rs_team_members (
                team_id, user_id, role, jersey_number, joined_at, status, created_at, updated_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (team_id, user_id) DO UPDATE SET
                role = EXCLUDED.role,
                jersey_number = EXCLUDED.jersey_number,
                joined_at = EXCLUDED.joined_at,
                status = EXCLUDED.status,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at
            """,
            (
                new_team_id,
                new_user_id,
                role,
                normalize_text(row["jersey_number"]) or None,
                joined_at,
                status,
                created_at,
                updated_at,
            ),
        )
        inserted += 1

        if new_user_id not in seen_target_members:
            pg_cur.execute(
                """
                INSERT INTO rs_team_members (
                    team_id, user_id, role, jersey_number, joined_at, status, created_at, updated_at
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (team_id, user_id) DO UPDATE SET
                    role = EXCLUDED.role,
                    jersey_number = EXCLUDED.jersey_number,
                    joined_at = EXCLUDED.joined_at,
                    status = EXCLUDED.status,
                    created_at = EXCLUDED.created_at,
                    updated_at = EXCLUDED.updated_at
                """,
                (
                    target_team_id,
                    new_user_id,
                    "member",
                    None,
                    joined_at,
                    1,
                    created_at,
                    updated_at,
                ),
            )
            seen_target_members.add(new_user_id)

    my_cur.execute("SELECT id, create_time, latest_login_date FROM rs_user_info ORDER BY id ASC")
    for row in my_cur.fetchall():
        new_user_id = mysql_to_pg_user_id.get(int(row["id"]))
        if new_user_id is None or new_user_id in seen_target_members:
            continue
        joined_at = normalize_dt(row["create_time"]) or normalize_dt(row["latest_login_date"]) or datetime.now()
        pg_cur.execute(
            """
            INSERT INTO rs_team_members (
                team_id, user_id, role, jersey_number, joined_at, status, created_at, updated_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (team_id, user_id) DO UPDATE SET
                role = EXCLUDED.role,
                jersey_number = EXCLUDED.jersey_number,
                joined_at = EXCLUDED.joined_at,
                status = EXCLUDED.status,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at
            """,
            (
                target_team_id,
                new_user_id,
                "member",
                None,
                joined_at,
                1,
                joined_at,
                joined_at,
            ),
        )
        seen_target_members.add(new_user_id)

    print(f"  球队成员导入：{inserted} 条，所有旧库人员已加入 {target_team_id}")


def import_activities(my_cur, pg_cur, team_id_map: dict[str, str]) -> None:
    my_cur.execute("SELECT * FROM rs_activity ORDER BY holding_date ASC, id ASC")
    rows = my_cur.fetchall()

    inserted = 0
    for row in rows:
        old_id = normalize_text(row["id"])
        if not old_id:
            continue

        home_team_id = normalize_text(row["home_team_id"]) or None
        away_team_id = normalize_text(row["away_team_id"]) or None
        if home_team_id:
            home_team_id = team_id_map.get(home_team_id, home_team_id)
        if away_team_id:
            away_team_id = team_id_map.get(away_team_id, away_team_id)
        if home_team_id is None and away_team_id is None:
            home_team_id = team_id_map["target"]

        description = normalize_text(row["description"]) or None
        status = int(row["status"] or 0)
        match_kind = "internal" if home_team_id and away_team_id and home_team_id == away_team_id else "external"
        if row.get("opposing") and away_team_id is None:
            match_kind = "external"

        create_time = normalize_dt(row["holding_date"]) or normalize_dt(row["start_time"]) or datetime.now()

        pg_cur.execute(
            """
            INSERT INTO rs_activity (
                id, cover, start_time, end_time, holding_date, location, location_latitude, location_longitude,
                name, opposing, status, description, home_team_id, away_team_id, color, opposing_color,
                players_per_team, match_kind, source_activity_id, team_registration_count, created_at, updated_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (id) DO UPDATE SET
                cover = EXCLUDED.cover,
                start_time = EXCLUDED.start_time,
                end_time = EXCLUDED.end_time,
                holding_date = EXCLUDED.holding_date,
                location = EXCLUDED.location,
                location_latitude = EXCLUDED.location_latitude,
                location_longitude = EXCLUDED.location_longitude,
                name = EXCLUDED.name,
                opposing = EXCLUDED.opposing,
                status = EXCLUDED.status,
                description = EXCLUDED.description,
                home_team_id = EXCLUDED.home_team_id,
                away_team_id = EXCLUDED.away_team_id,
                color = EXCLUDED.color,
                opposing_color = EXCLUDED.opposing_color,
                players_per_team = EXCLUDED.players_per_team,
                match_kind = EXCLUDED.match_kind,
                source_activity_id = EXCLUDED.source_activity_id,
                team_registration_count = EXCLUDED.team_registration_count,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at
            """,
            (
                old_id,
                truncate_text(row["cover"], 500),
                normalize_dt(row["start_time"]) or create_time,
                normalize_dt(row["end_time"]) or create_time,
                normalize_dt(row["holding_date"]) or create_time,
                truncate_text(row["location"], 255) or "",
                None,
                None,
                truncate_text(row["name"], 255) or "未命名",
                truncate_text(row["opposing"], 255),
                status,
                description,
                home_team_id,
                away_team_id,
                truncate_text(row["color"], 32),
                truncate_text(row["opposing_color"], 32),
                int(row["players_per_team"]) if row["players_per_team"] is not None else None,
                match_kind,
                None,
                None,
                create_time,
                normalize_dt(row.get("updated_at")) or create_time,
            ),
        )
        inserted += 1

    print(f"  活动导入：{inserted} 条")


def load_activity_ids(pg_cur) -> set[str]:
    pg_cur.execute("SELECT id FROM rs_activity")
    return {str(row[0]).strip() for row in pg_cur.fetchall()}


def import_user_activity(my_cur, pg_cur, mysql_to_pg_user_id: dict[int, int], activity_ids: set[str]) -> None:
    my_cur.execute("SELECT * FROM rs_user_activity ORDER BY operation_time ASC")
    rows = my_cur.fetchall()

    skipped = 0
    values: list[tuple[Any, ...]] = []

    for row in rows:
        old_user_id = int(row["user_id"])
        new_user_id = mysql_to_pg_user_id.get(old_user_id)
        if new_user_id is None:
            skipped += 1
            continue

        activity_id = normalize_text(row["activity_id"])
        if activity_id not in activity_ids:
            skipped += 1
            continue

        operation_time = normalize_dt(row["operation_time"]) or datetime.now()

        values.append(
            (
                activity_id,
                new_user_id,
                int(row["stand"] or 0),
                int(row["registration_count"] or 0),
                int(row["paid"] or 0),
                operation_time,
                normalize_dt(row.get("created_at")) or operation_time,
                normalize_dt(row.get("updated_at")) or normalize_dt(row.get("created_at")) or operation_time,
            ),
        )

    execute_batch(
        pg_cur,
        """
        INSERT INTO rs_user_activity (
            activity_id, user_id, stand, registration_count, paid, operation_time, created_at, updated_at
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (activity_id, user_id) DO UPDATE SET
            stand = EXCLUDED.stand,
            registration_count = EXCLUDED.registration_count,
            paid = EXCLUDED.paid,
            operation_time = EXCLUDED.operation_time,
            created_at = EXCLUDED.created_at,
            updated_at = EXCLUDED.updated_at
        """,
        values,
        page_size=500,
    )

    print(f"  报名记录导入：{len(values)} 条，跳过 {skipped} 条")


def import_registration_log(my_cur, pg_cur, mysql_to_pg_user_id: dict[int, int], activity_ids: set[str]) -> None:
    my_cur.execute("SELECT * FROM rs_registration_log ORDER BY id ASC")
    rows = my_cur.fetchall()

    inserted = 0
    skipped = 0

    for row in rows:
        old_user_id = int(row["user_id"])
        new_user_id = mysql_to_pg_user_id.get(old_user_id)
        if new_user_id is None:
            skipped += 1
            continue

        activity_id = normalize_text(row["activity_id"])
        if activity_id not in activity_ids:
            skipped += 1
            continue

        pg_cur.execute(
            """
            INSERT INTO rs_registration_log (
                activity_id, user_id, previous_stand, current_stand, registration_count, operation_time, created_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                activity_id,
                new_user_id,
                row["previous_stand"],
                int(row["current_stand"] or 0),
                int(row["registration_count"] or 0),
                normalize_dt(row["operation_time"]) or datetime.now(),
                normalize_dt(row["created_at"]) or datetime.now(),
            ),
        )
        inserted += 1

    print(f"  报名日志导入：{inserted} 条，跳过 {skipped} 条")


def import_accounting(
    my_cur,
    pg_cur,
    mysql_to_pg_user_id: dict[int, int],
    activity_ids: set[str],
    import_finance: bool,
) -> None:
    if not import_finance:
        print("  已按参数跳过账务导入")
        return

    my_cur.execute("SELECT * FROM rs_user_accounts ORDER BY user_id ASC")
    rows = my_cur.fetchall()
    inserted = 0
    for row in rows:
        new_user_id = mysql_to_pg_user_id.get(int(row["user_id"]))
        if new_user_id is None:
            continue
        pg_cur.execute(
            """
            INSERT INTO rs_user_accounts (
                user_id, balance, total_recharge, total_expense, total_penalty, last_updated, version, status, created_at, updated_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (user_id) DO UPDATE SET
                balance = EXCLUDED.balance,
                total_recharge = EXCLUDED.total_recharge,
                total_expense = EXCLUDED.total_expense,
                total_penalty = EXCLUDED.total_penalty,
                last_updated = EXCLUDED.last_updated,
                version = EXCLUDED.version,
                status = EXCLUDED.status,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at
            """,
            (
                new_user_id,
                Decimal(str(row["balance"])),
                Decimal(str(row["total_recharge"])),
                Decimal(str(row["total_expense"])),
                Decimal(str(row["total_penalty"])),
                normalize_dt(row["last_updated"]) or datetime.now(),
                int(row["version"] or 1),
                int(row["status"] or 1),
                normalize_dt(row["created_at"]) or datetime.now(),
                normalize_dt(row["updated_at"]) or datetime.now(),
            ),
        )
        inserted += 1
    print(f"  用户账户导入：{inserted} 条")

    my_cur.execute("SELECT * FROM rs_recharge_records ORDER BY created_at ASC, id ASC")
    rows = my_cur.fetchall()
    inserted = 0
    for row in rows:
        new_user_id = mysql_to_pg_user_id.get(int(row["user_id"]))
        if new_user_id is None:
            continue
        pg_cur.execute(
            """
            INSERT INTO rs_recharge_records (
                user_id, amount, payment_method, transaction_no, recharge_date, description, status, created_at, updated_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                new_user_id,
                Decimal(str(row["amount"])),
                truncate_text(row["payment_method"], 32) or "wechat",
                truncate_text(row["transaction_no"], 100),
                row["recharge_date"],
                truncate_text(row["description"], 500),
                int(row["status"] or 1),
                normalize_dt(row["created_at"]) or datetime.now(),
                normalize_dt(row["updated_at"]) or datetime.now(),
            ),
        )
        inserted += 1
    print(f"  充值记录导入：{inserted} 条")

    my_cur.execute("SELECT * FROM rs_payment_orders ORDER BY created_at ASC, id ASC")
    rows = my_cur.fetchall()
    inserted = 0
    for row in rows:
        new_user_id = mysql_to_pg_user_id.get(int(row["user_id"]))
        if new_user_id is None:
            continue
        pg_cur.execute(
            """
            INSERT INTO rs_payment_orders (
                order_no, user_id, amount, payment_type, status, prepay_id, transaction_id, description,
                created_at, updated_at, paid_at, cancelled_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (order_no) DO UPDATE SET
                user_id = EXCLUDED.user_id,
                amount = EXCLUDED.amount,
                payment_type = EXCLUDED.payment_type,
                status = EXCLUDED.status,
                prepay_id = EXCLUDED.prepay_id,
                transaction_id = EXCLUDED.transaction_id,
                description = EXCLUDED.description,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at,
                paid_at = EXCLUDED.paid_at,
                cancelled_at = EXCLUDED.cancelled_at
            """,
            (
                truncate_text(row["order_no"], 64),
                new_user_id,
                Decimal(str(row["amount"])),
                "wechat",
                "pending" if int(row["status"] or 0) == 0 else "paid",
                truncate_text(row["prepay_id"], 128),
                truncate_text(row["transaction_id"], 128),
                None,
                normalize_dt(row["created_at"]) or datetime.now(),
                normalize_dt(row["updated_at"]) or datetime.now(),
                normalize_dt(row["paid_time"]),
                None,
            ),
        )
        inserted += 1
    print(f"  支付订单导入：{inserted} 条")

    my_cur.execute("SELECT * FROM rs_activity_order ORDER BY create_time ASC, activity_id ASC")
    rows = my_cur.fetchall()
    inserted = 0
    for row in rows:
        activity_id = normalize_text(row["activity_id"])
        if activity_id not in activity_ids:
            continue
        pg_cur.execute(
            """
            INSERT INTO rs_activity_order (
                activity_id, description, fee, total, activity_holding_time, create_time, updated_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (activity_id) DO UPDATE SET
                description = EXCLUDED.description,
                fee = EXCLUDED.fee,
                total = EXCLUDED.total,
                activity_holding_time = EXCLUDED.activity_holding_time,
                create_time = EXCLUDED.create_time,
                updated_at = EXCLUDED.updated_at
            """,
            (
                activity_id,
                truncate_text(row["description"], 500) or "",
                Decimal(str(row["fee"])),
                int(row["total"] or 0),
                normalize_dt(row["activity_holding_time"]),
                normalize_dt(row["create_time"]) or datetime.now(),
                normalize_dt(row.get("updated_at")) or normalize_dt(row["create_time"]) or datetime.now(),
            ),
        )
        inserted += 1
    print(f"  活动账单导入：{inserted} 条")


def main() -> None:
    clear_pycache()
    cfg = parse_args()
    print("迁移配置：")
    print(f"  MySQL: {cfg.mysql_user}@{cfg.mysql_host}:{cfg.mysql_port}/{cfg.mysql_db}")
    print(f"  PG: {cfg.pg_dsn}")
    print(f"  dry_run={cfg.dry_run}, reset={cfg.reset}, import_finance={cfg.import_finance}")

    mysql_to_pg_user_id: dict[int, int] = {}
    team_id_map: dict[str, str] = {}

    if cfg.dry_run:
        print("DRY_RUN 已启用，跳过实际迁移。")
        return

    my_conn = mysql_connect(cfg)
    pg_conn = pg_connect(cfg)
    pg_conn.autocommit = False

    try:
        with my_conn.cursor() as my_cur, pg_conn.cursor() as pg_cur:
            if cfg.reset:
                print("清空新库测试数据...")
                truncate_target_db(pg_cur)
                ensure_seed_data(pg_cur)

            print("导入用户...")
            import_users(my_cur, pg_cur, mysql_to_pg_user_id)

            print("导入球队...")
            import_teams(my_cur, pg_cur, mysql_to_pg_user_id, team_id_map)

            print("导入球队成员...")
            import_team_members(my_cur, pg_cur, mysql_to_pg_user_id, team_id_map)

            print("导入活动...")
            import_activities(my_cur, pg_cur, team_id_map)
            activity_ids = load_activity_ids(pg_cur)

            print("导入报名记录...")
            import_user_activity(my_cur, pg_cur, mysql_to_pg_user_id, activity_ids)

            print("导入报名日志...")
            import_registration_log(my_cur, pg_cur, mysql_to_pg_user_id, activity_ids)

            print("导入账务数据...")
            import_accounting(my_cur, pg_cur, mysql_to_pg_user_id, activity_ids, cfg.import_finance)

        pg_conn.commit()
        print("✅ 迁移完成")
    except Exception:
        pg_conn.rollback()
        raise
    finally:
        my_conn.close()
        pg_conn.close()


if __name__ == "__main__":
    main()
