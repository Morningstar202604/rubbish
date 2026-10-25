"""Editor 分配审稿人：候选端点 + 权限边界。

以前前端编辑工作台的「分配审稿人」下拉调用 /admin/users——只有 admin
能访问，非 admin 的 editor 拿到 403 后看到「没有可指派的审稿人」。
新端点 /submissions/reviewer-candidates 只返回持有 reviewer 角色且启用
的账号，并要求 editor 权限。
"""

from __future__ import annotations

from conftest import auth_headers
from httpx import AsyncClient


async def _assign(client: AsyncClient, admin: dict, user_id: int, role: str) -> None:
    r = await client.post(
        f"/api/admin/users/{user_id}/roles", json={"role": role}, headers=auth_headers(admin)
    )
    assert r.status_code == 201, r.text


async def test_candidates_empty_when_nobody_is_reviewer(
    client: AsyncClient, admin_user: dict
) -> None:
    r = await client.get("/api/submissions/reviewer-candidates", headers=auth_headers(admin_user))
    assert r.status_code == 200
    assert r.json()["data"] == []


async def test_candidates_include_reviewer_role_holders(
    client: AsyncClient, admin_user: dict, test_user: dict
) -> None:
    await _assign(client, admin_user, int(test_user["user_id"]), "reviewer")
    r = await client.get("/api/submissions/reviewer-candidates", headers=auth_headers(admin_user))
    assert r.status_code == 200
    data = r.json()["data"]
    assert [c["username"] for c in data] == ["testuser"]
    # 只暴露分配所需字段，不带 is_admin / 密码类信息
    assert set(data[0]) == {"id", "username", "email"}


async def test_non_editor_gets_403(client: AsyncClient, test_user: dict) -> None:
    r = await client.get("/api/submissions/reviewer-candidates", headers=auth_headers(test_user))
    assert r.status_code == 403


async def test_editor_without_admin_can_list_pending_submissions(
    client: AsyncClient, admin_user: dict, test_user: dict
) -> None:
    """非 admin 的 editor 也能进编辑工作台（此前前端路由只放行 isAdmin）。"""
    await _assign(client, admin_user, int(test_user["user_id"]), "editor")
    login = await client.post(
        "/api/auth/login",
        json={"username": "testuser", "password": "password123"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    for path in ("/api/submissions/pending", "/api/submissions/reviewer-candidates"):
        r = await client.get(path, headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200, f"{path}: {r.text[:200]}"


async def test_section_editor_has_editor_access(
    client: AsyncClient, admin_user: dict, test_user: dict
) -> None:
    """section_editor（栏目编辑）此前可分配但无任何权限：应等同 editor 入口。"""
    await _assign(client, admin_user, int(test_user["user_id"]), "section_editor")
    login = await client.post(
        "/api/auth/login",
        json={"username": "testuser", "password": "password123"},
    )
    token = login.json()["access_token"]
    assert login.json()["roles"] == ["section_editor"]
    for path in ("/api/submissions/pending", "/api/submissions/reviewer-candidates"):
        r = await client.get(path, headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200, f"{path}: {r.text[:200]}"
