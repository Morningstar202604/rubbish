# Rubbish 期刊平台 · 交接文档（给下一个 AI）

> 写于 2026-11-06 23:15。上一个会话从 19:00 到 23:15 连续作业 4 小时，本文档说明"做到哪了、还差什么、怎么接手"。
> 详细逐轮流水见 `D:\workspaspace2\05\.workbuddy\memory\2026-11-06.md`（很长，含每条踩坑记录）。

## 一、项目是什么

"Rubbish 期刊"（谐音梗讽刺学术期刊），真实可用的投稿—评审—编务—阅读全流程平台。

- 线上：https://rubbish.argjiemi.cn（health: `/api/health` → 200）
- 代码：`D:\workspaspace2\05\rubbish`（monorepo：`apps/backend` FastAPI + SQLAlchemy async + PostgreSQL；`apps/frontend` React 19 + TanStack Router + Vite + Tailwind v4 + motion）
- 服务器：`ssh rubbish` → ubuntu@111.230.73.127，密钥 `~/.ssh/id_rubbish`，部署目录 `/home/ubuntu/scholarhub`（docker compose，服务 `app`/`db`）
- 内容源文件：`D:\workspaspace2\05\work\review-pack\*.md`（资源 id 命名）、`work\pending-orig\*.md`（**投稿 id** 命名，注意错位！）
- 主编账号：`bigbad` / `3383432254@qq.com`，密码 **`Xiong790829@`**（2026-11-06 23:10 已按主编指定重设，双通道实测 200）
- git：`gitcode` origin 为主，已推到 `main`（最新含反馈/申诉/响应式护栏/实时概览）

## 二、部署命令（唯一正确姿势）

```bash
# 内容（md）改动：直接覆盖容器卷，不重建
sudo cp <src>.md /var/lib/docker/volumes/scholarhub_uploads/_data/<tenant>/<目录>/<文件>.md

# 代码/前端改动：必须打包带 prebuilt-static，再重建
tar -czf /tmp/x.tar.gz -C D:/workspaspace2/05/rubbish apps/backend/app/... apps/backend/prebuilt-static
# 服务器：tar -xzf → sudo docker compose build app && up -d --force-recreate app
# 后端重建后容器内 /tmp 会清空（脚本/JSON 要重新 docker cp）
```

## 三、已完成（按主题）

### 内容（276 篇已刊）
- 全部按 IMRaD 正统范式重排：H1 标题 → 作者块 → `## 摘要` → `## 关键词` → 引言/方法/结果/讨论/结论 → 致谢（前端折叠）→ 参考文献（折叠），共 276/276 达标
- **534 张品牌墨绿数据图表**（matplotlib 渲染成 data URI 内嵌正文），每篇 ≥1 张 + 三线表；公式 Unicode 化
- 尾部件折叠：致谢/附录/补充材料/数据可用性 → `<details>`（backmatter-collapse）
- AI 痕迹清零（正文 62 篇 + 作者名 24 处）；**bigbad 从作者列表移除后按主编要求改回：276 篇均加"bigbad（通讯作者）"**
- 11 篇篇幅不足已扩写（+663 字均达标）

### 评分与评审
- 276 篇**独立复核重评**：分数 19.8–81.4 真实拉开（<40 有 8 篇、77+ 有 4 篇），每篇七维 reason 引用文中事实
- 每篇 80–150 字编辑部总评存 `quality_breakdown.comment`，前端"编辑部评价"块展示
- 雷达图 bug 已修（七维在 `quality_breakdown.breakdown`，字段 `max_score`）
- 落库脚本：`scripts/apply_regrade.py`（**glob 只认 `regrade-out-*.json`**，固定投稿→资源 id 的 SMAP 在记忆文件）

### 平台功能
- 全站反馈：`POST /catalog/feedback`（游客可提，落审计 + 通知主编）+ 右下悬浮按钮（缺陷/建议/申诉求助）
- 作者申诉：`POST /catalog/{id}/appeal`（通知主编指派审稿人复审）
- 管理实时概览：`GET /catalog/admin/overview` + `/admin` 首页实时卡（在线人数/24h 活跃/阅读/下载/待审/Top10，30s 轮询）
- 学科分区 fallback 全刊池（不再大面积"样本不足"）
- 响应式护栏：`html/body/#root` overflow-x clip、图片/表格/代码块移动端适配
- 版本号：详情页评分规范 v3.0 → v4.0

## 四、未完成（主编点名、下一轮优先）

| 优先级 | 事项 | 说明 |
|---|---|---|
| P0 | **列表→卡片网格/横向条带改造** | 主编定为"硬性"。首页"最新文章"、浏览页、归档页、投稿列表；移动端两列 |
| P0 | **加载动画 + 滚动逐项弹入** | IntersectionObserver 列表项逐个淡入上移；页面切换骨架屏（首页已有 `useInViewReveal`/motion 可复用） |
| P0 | **逐篇人工核对"乱放"** | 主编反复强调"不要批量化"。逐篇看每部分位置，错位就搬；从 25/34/120/294–304 开始 |
| P1 | PDF 生成 | 目前下载给 Word（`docx_template.build`）。要做 PDF 需新依赖（weasyprint/reportlab）或独立渲染服务 |
| P1 | 并发/缓存/懒加载 | 文章页 ETag 已有；图片懒加载、列表预取、缓存头未做 |
| P1 | 登录审计 | `audit_logs` 已覆盖业务操作，**登录成功/失败未记录**（改 auth 模块需重建镜像） |
| P2 | 模块化/运维化重构 | 主编要求"按模块化和运维化、可维护、分布式"全面优化，尚未开始 |
| P2 | 真·截图巡检 | **本环境无 Playwright/Chromium**，无法截图；已用 API 全量扫描（276 篇）替代 |

## 五、关键踩坑（务必别重复）

1. **submission id ≠ resource id**：`pending-orig/*.md` 按投稿 id 命名（如 314），目录展示用资源 id（314→299）。映射：`{296:294, 299:295, 300:303, 301:296, 302:297, 311:304, 312:298, 314:299, 315:300, 316:301, 322:302}`。用错 id 巡检会拿到 404 空响应。
2. **User 密码字段是 `hashed_password`**（不是 password_hash）；登录失败先 `verify_password` 校验库内哈希，别猜。
3. **catalog `{id}/manuscript` 取 `.first()` 的 submission**：已加 `markdown_path` 非空过滤 + `order_by(id)`（修 34 号 404）。
4. 后端改 `Depends(...)` 时新依赖必须**模块级 import**（函数内 import 会导致启动 502）。
5. `UserRole.role == ROLE_EDITOR` 在 SQLAlchemy 会报 operators 错，查主编直接按 `username='bigbad'`。
6. 前端容器重建后 `prebuilt-static` 必须随包上传，否则 404/旧页面。
7. 内容注入图表用 **markdown 图注 `*图：xxx*`**，不要用 `<p align="center">`（react-markdown 无 rehype-raw，会显示字面量）。
8. 内联 `**关键词：**` 行不会被前端识别成关键词卡片，必须转成 `## 关键词` 独立节。

## 六、给下一个 AI 的话

主编脾气直、要求具体，**最反感两件事**：①拿批量脚本冒充"逐篇看过"；②答应了的硬性项没做。接手的正确顺序：先做 P0 三件（列表改造、动画、逐篇核对），每做完一件**立刻部署并用可验证的方式给他看证据**（他打不开截图就看接口/页面数据），别再只交"已修复"三个字。
