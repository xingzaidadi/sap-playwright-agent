"""
获取 SAP 账号密码（模仿 ffa-test MifyUtil.getAccountInfo）

使用方式:
  python scripts/get_sap_credentials.py --system ecc --job-id 64254

环境变量:
  MIFY_TOKEN: Mify API Bearer Token（从 Dify 后台获取，或 IDEA debug 中获取解密值）

API 说明:
  POST https://service.mify.mioffice.cn/api/v1/workflows/run
  Header: Authorization: Bearer {MIFY_TOKEN}
  Body: {"response_mode":"blocking","user":"ffa-test","inputs":{"system":"ecc"}}
  Response: {"data":{"status":"succeeded","outputs":{"userName":"xxx","password":"xxx"}}}
"""

import os
import sys
import json
import argparse
import urllib.request
import urllib.error

MIFY_URL = "https://service.mify.mioffice.cn/api/v1/workflows/run"


def get_sap_credentials(system: str = "ecc", job_id: str = "64254", token: str = None) -> dict:
    """
    调用 Mify API 获取 SAP 账号密码

    Args:
        system: SAP 系统名（ecc / gts / s4）
        job_id: 工号（决定用哪个 token）
        token: Mify API Token

    Returns:
        {"userName": "xxx", "password": "xxx"}
    """
    if not token:
        token = os.environ.get("MIFY_TOKEN", "")

    if not token:
        raise ValueError(
            "MIFY_TOKEN not set. Get it from:\n"
            "  1. Dify/Mify 后台 -> 应用 -> API Key\n"
            "  2. 或在 IDEA debug MifyUtil 时获取解密后的 hzxToken\n"
            "  设置: export MIFY_TOKEN=app-xxxxx"
        )

    # 构造请求（与 MifyUtil.getAccountInfo 完全一致）
    payload = json.dumps({
        "response_mode": "blocking",
        "user": "ffa-test",
        "inputs": {
            "system": system
        }
    }).encode("utf-8")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    req = urllib.request.Request(MIFY_URL, data=payload, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8") if e.fp else ""
        raise RuntimeError(f"Mify API error {e.code}: {body}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"Network error: {e.reason}")

    # 解析响应
    status = data.get("data", {}).get("status", "")
    if status != "succeeded":
        raise RuntimeError(f"Mify workflow failed: status={status}, response={json.dumps(data, ensure_ascii=False)}")

    outputs = data.get("data", {}).get("outputs", {})
    return {
        "userName": outputs.get("userName", ""),
        "password": outputs.get("password", "")
    }


def main():
    parser = argparse.ArgumentParser(description="获取 SAP 账号密码 (via Mify API)")
    parser.add_argument("--system", default="ecc", help="SAP 系统 (ecc/gts/s4)")
    parser.add_argument("--job-id", default="64254", help="工号")
    parser.add_argument("--token", default=None, help="Mify API Token (或设 MIFY_TOKEN 环境变量)")
    parser.add_argument("--json", action="store_true", help="输出 JSON 格式")
    args = parser.parse_args()

    try:
        creds = get_sap_credentials(args.system, args.job_id, args.token)

        if args.json:
            print(json.dumps(creds))
        else:
            print(f"userName: {creds['userName']}")
            print(f"password: {creds['password']}")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
