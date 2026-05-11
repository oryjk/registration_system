#!/usr/bin/env python3
"""把数据库中的 base64 用户头像转存到 MinIO，并把 avatar_url 更新为对象 URL。"""

from __future__ import annotations

import base64
import binascii
import os
from dataclasses import dataclass

import boto3
import psycopg2
from botocore.config import Config as BotoConfig


DEFAULT_PG_DSN = os.getenv(
    "PG_DSN",
    "postgresql://football_app:IgrfuwpVPSIu_G1jo3zeIGGuXOBo7-JI@117.72.164.211:5432/registration_system?sslmode=disable",
)


@dataclass(frozen=True)
class UploadConfig:
    endpoint: str
    access_key: str
    secret_key: str
    bucket: str
    region: str
    public_url_prefix: str


def load_env_file(path: str) -> None:
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as file:
        for raw_line in file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def load_upload_config() -> UploadConfig:
    load_env_file("registration_system_rs/.env")
    return UploadConfig(
        endpoint=os.environ["UPLOAD_MINIO_ENDPOINT"],
        access_key=os.environ["UPLOAD_MINIO_ACCESS_KEY"],
        secret_key=os.environ["UPLOAD_MINIO_SECRET_KEY"],
        bucket=os.environ["UPLOAD_MINIO_BUCKET"],
        region=os.environ.get("UPLOAD_MINIO_REGION", "us-east-1"),
        public_url_prefix=os.environ["UPLOAD_MINIO_PUBLIC_URL_PREFIX"].rstrip("/"),
    )


def decode_avatar(value: str) -> tuple[bytes, str] | None:
    text = value.strip()
    if not text:
        return None

    content_type = "image/jpeg"
    if text.startswith("data:image/"):
        header, _, payload = text.partition(",")
        if not payload:
            return None
        content_type = header.removeprefix("data:").split(";")[0] or content_type
        text = payload

    try:
        data = base64.b64decode(text, validate=True)
    except binascii.Error:
        data = base64.b64decode(text + "=" * (-len(text) % 4), validate=False)

    if data.startswith(b"\xff\xd8\xff"):
        return data, "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return data, "image/png"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return data, "image/webp"
    if data:
        return data, content_type
    return None


def extension_for(content_type: str) -> str:
    if content_type == "image/png":
        return "png"
    if content_type == "image/webp":
        return "webp"
    return "jpg"


def main() -> None:
    upload = load_upload_config()
    s3 = boto3.client(
        "s3",
        endpoint_url=upload.endpoint,
        aws_access_key_id=upload.access_key,
        aws_secret_access_key=upload.secret_key,
        region_name=upload.region,
        config=BotoConfig(s3={"addressing_style": "path"}),
    )

    conn = psycopg2.connect(os.environ.get("PG_DSN", DEFAULT_PG_DSN))
    conn.autocommit = False

    uploaded = 0
    skipped = 0
    failed: list[tuple[int, str]] = []

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, avatar_url
                FROM rs_user_info
                WHERE avatar_url LIKE 'data:image/%;base64,%'
                   OR (avatar_url <> '' AND avatar_url NOT LIKE 'http%' AND avatar_url NOT LIKE 'data:%')
                ORDER BY id
                """
            )
            rows = cur.fetchall()
            print(f"待转存头像：{len(rows)}")

            for user_id, avatar_url in rows:
                decoded = decode_avatar(avatar_url)
                if decoded is None:
                    skipped += 1
                    failed.append((int(user_id), "base64 解码为空或无效"))
                    continue

                data, content_type = decoded
                ext = extension_for(content_type)
                object_key = f"avatars/legacy-user-{user_id}.{ext}"
                public_url = f"{upload.public_url_prefix}/{object_key}"

                s3.put_object(
                    Bucket=upload.bucket,
                    Key=object_key,
                    Body=data,
                    ContentType=content_type,
                )
                cur.execute(
                    "UPDATE rs_user_info SET avatar_url = %s WHERE id = %s",
                    (public_url, user_id),
                )
                uploaded += 1
                print(f"  user_id={user_id} -> {public_url}")

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    print(f"转存完成：成功 {uploaded}，跳过 {skipped}")
    if failed:
        print("失败明细：")
        for user_id, reason in failed:
            print(f"  user_id={user_id}: {reason}")


if __name__ == "__main__":
    main()

