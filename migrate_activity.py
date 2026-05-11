#!/usr/bin/env python3
"""
迁移 rs_activity / rs_user_activity / rs_registration_log
从 MySQL → PostgreSQL
"""
import pymysql
import psycopg2
from datetime import datetime

MYSQL_CFG = dict(host='117.72.164.211', port=3306, user='root',
                 password='beifa888', db='registration_system', charset='utf8mb4')
PG_DSN    = "postgresql://football_app:IgrfuwpVPSIu_G1jo3zeIGGuXOBo7-JI@117.72.164.211:5432/registration_system?sslmode=disable"

my  = pymysql.connect(**MYSQL_CFG)
pg  = psycopg2.connect(PG_DSN)
pg.autocommit = False

mc = my.cursor(pymysql.cursors.DictCursor)
pc = pg.cursor()

now = datetime.now()

# ───── 1. rs_activity ─────
print("=== 迁移 rs_activity ===")
mc.execute("SELECT * FROM rs_activity ORDER BY holding_date ASC")
rows = mc.fetchall()
ok = fail = skip = 0
for row in rows:
    aid = row['id']
    pc.execute("SELECT 1 FROM rs_activity WHERE id=%s", (aid,))
    if pc.fetchone():
        skip += 1
        continue
    try:
        pc.execute("SAVEPOINT sp_act")
        pc.execute("""
            INSERT INTO rs_activity
              (id, cover, start_time, end_time, holding_date, location, name,
               opposing, status, description, home_team_id, away_team_id,
               color, opposing_color, players_per_team, created_at, updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            aid,
            row['cover'],
            row['start_time'] or now,
            row['end_time']   or now,
            row['holding_date'] or now,
            row['location'] or '',
            row['name'] or '未命名',
            row['opposing'],
            row['status'] or 0,
            row['description'],
            row['home_team_id'] if row['home_team_id'] else None,
            row['away_team_id'] if row['away_team_id'] else None,
            row['color'],
            row['opposing_color'],
            row['players_per_team'],
            now, now,
        ))
        pc.execute("RELEASE SAVEPOINT sp_act")
        ok += 1
    except Exception as e:
        pc.execute("ROLLBACK TO SAVEPOINT sp_act")
        print(f"  SKIP activity {aid}: {e}")
        fail += 1
pg.commit()
print(f"  新增 {ok}，跳过已存在 {skip}，失败 {fail}，共 {len(rows)} 条")

# ───── 2. rs_user_activity ─────
print("\n=== 迁移 rs_user_activity ===")
mc.execute("SELECT * FROM rs_user_activity")
rows = mc.fetchall()

# 先获取 PG 中已有的 activity_id 集合，避免外键冲突
pc.execute("SELECT id FROM rs_activity")
valid_act_ids = {r[0] for r in pc.fetchall()}
# 已有的 user_id 集合
pc.execute("SELECT id FROM rs_user_info")
valid_user_ids = {r[0] for r in pc.fetchall()}

ok = fail = skip = 0
for row in rows:
    aid  = row['activity_id']
    uid  = row['user_id']
    if aid not in valid_act_ids:
        skip += 1
        continue
    if uid not in valid_user_ids:
        skip += 1
        continue
    # 检查是否已存在
    pc.execute("SELECT 1 FROM rs_user_activity WHERE activity_id=%s AND user_id=%s", (aid, uid))
    if pc.fetchone():
        skip += 1
        continue
    try:
        pc.execute("SAVEPOINT sp_ua")
        pc.execute("""
            INSERT INTO rs_user_activity
              (activity_id, user_id, stand, registration_count, paid, operation_time, created_at, updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            aid, uid,
            row['stand'] or 0,
            row['registration_count'] or 0,
            row['paid'] or 0,
            row['operation_time'] or now,
            now, now,
        ))
        pc.execute("RELEASE SAVEPOINT sp_ua")
        ok += 1
    except Exception as e:
        pc.execute("ROLLBACK TO SAVEPOINT sp_ua")
        print(f"  SKIP user_activity act={aid} user={uid}: {e}")
        fail += 1
pg.commit()
print(f"  新增 {ok}，跳过 {skip}，失败 {fail}，共 {len(rows)} 条")

# ───── 3. rs_registration_log ─────
print("\n=== 迁移 rs_registration_log ===")
mc.execute("SELECT * FROM rs_registration_log ORDER BY id ASC")
rows = mc.fetchall()
ok = fail = skip = 0
for row in rows:
    aid = row['activity_id']
    uid = row['user_id']
    if aid not in valid_act_ids or uid not in valid_user_ids:
        skip += 1
        continue
    try:
        pc.execute("SAVEPOINT sp_rl")
        pc.execute("""
            INSERT INTO rs_registration_log
              (activity_id, user_id, previous_stand, current_stand,
               registration_count, operation_time, created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
        """, (
            aid, uid,
            row['previous_stand'],
            row['current_stand'] or 0,
            row['registration_count'] or 0,
            row['operation_time'] or now,
            now,
        ))
        pc.execute("RELEASE SAVEPOINT sp_rl")
        ok += 1
    except Exception as e:
        pc.execute("ROLLBACK TO SAVEPOINT sp_rl")
        print(f"  SKIP log act={aid} user={uid}: {e}")
        fail += 1
pg.commit()
print(f"  新增 {ok}，跳过 {skip}，失败 {fail}，共 {len(rows)} 条")

print("\n✅ 迁移完成")
my.close()
pg.close()
