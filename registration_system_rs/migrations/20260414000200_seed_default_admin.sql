INSERT INTO rs_admin_user (
    username,
    password_hash,
    nickname,
    status,
    is_super_admin
)
SELECT
    'admin',
    '$2y$12$4A6LXSTKotlRRL4a5Xum3OarsLxRfqN8ge6aficTEjkRRW30FIplq',
    '默认管理员',
    1,
    1
WHERE NOT EXISTS (
    SELECT 1
    FROM rs_admin_user
    WHERE username = 'admin'
);
