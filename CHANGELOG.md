# Changelog

本文件记录 Rubbish 每个版本值得关注的变更，遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)
，版本号遵循语义化版本 `主版本.次版本.修订号`（三段都要写全，修订号不得省略）。

版本号的唯一真源是仓库根目录 `VERSION`，必须与
`apps/backend/pyproject.toml`、`apps/frontend/package.json`、`apps/backend/app/__init__.py`
四处完全一致，由 `scripts/check-version.sh` 守门。

## [0.7.0] — 2026-10-24

### Changed

- **示例论文全面重写，严格对标真实期刊**：7 篇论文正文从每篇数百字扩写至
  2 500—3 700 字（含结构式摘要后全文 3 500—4 500 字），PDF 达 5—7 页；
  多级编号章节（1／2.1）、图表编号交叉引用、致谢，参考文献全部替换为
  真实存在的文献并按 GB/T 7714 格式著录（11—15 条/篇）。
- **PDF 排版升级为 GB 学术格式**：宋体正文（小四）＋黑体标题（四号/小四）＋
  楷体致谢，3.0cm 左右页边距、20pt 行距、首行缩进两字符、三线表、
  参考文献悬挂缩进、居中页码与期刊页眉。
- **阅读器视觉升级**：桌面端目录侧栏（标题提取、点击跳转）、参考文献
  默认折叠（条数提示、展开阅读）、评论区超 160 字长评论折叠展开；
  目录/正文锚点由文本哈希生成。

### Added

- `_deploy` 论文工具链内容源化：papers_full_a/b/c（内容）→ redraw_papers
  （GB 排版渲染）→ build_manuscripts（Markdown 导出），全链路可复现。

## [0.6.2] — 2026-10-24

### Added

- **在线阅读改版：Markdown 富文本**（替代浏览器端 PDF 渲染）。
  上传稿件（PDF/docx/txt/md）时服务端自动转换为 Markdown
  （`pymupdf4llm` 版面感知抽取 + 图片 data URI 内嵌；`mammoth` +
  `markdownify` 处理 docx；失败静默降级，绝不阻断上传）。新增
  `submissions.markdown_path`（迁移 008）与公开端点
  `GET /api/catalog/{id}/manuscript`（可见性边界与 PDF 下载一致）。
  阅读器默认富文本视图：学术排版（衬线标题/三线表/图注/KaTeX 公式）、
  图片与表格完整呈现、滚动进度复用原管道；"原稿 PDF"一键切换兜底，
  PDF 下载通道不变。列表与详情新增 `has_markdown`。
- 存量 7 篇论文从排版源生成 Markdown 版（图表 PNG 内嵌），线上补齐。

### Changed

- mypy：新增稿件转换依赖的 `untyped_calls_exclude` 与 overrides
  （pymupdf/pymupdf4llm/mammoth/markdownify 均无 py.typed）。

## [0.6.1] — 2026-10-24

### Fixed

- **登录支持"用户名或邮箱"**（用户实际故障根因）：登录页文案一直写着
  "用户名或邮箱"，后端却只匹配 username 列——用邮箱登录必 401。现改为
  用户名精确匹配 OR 邮箱 lower 等值匹配（同租户内），大小写不敏感、
  自动去首尾空格。邮箱登录错误密码仍 401。
- **详情页游客门槛清除**：桌面右栏与移动端底栏的"登录后阅读全文"CTA
  移除——在线阅读与下载 PDF 对所有人无条件开放（期刊天职）；游客改为
  展示"游客模式"说明卡（进度存本设备，登录可收藏/同步/评论）。

## [0.6.0] — 2026-10-24

### Added

- **评论系统**：新 `comments` 模块（迁移 007）。`GET /api/comments?resource_id=`
  公开可读；`POST` 登录可评（仅限已刊出资源，1–1000 字，不可编辑）；`DELETE`
  本人或管理员（`comment.delete` 审计）。详情页新增读者评论区：游客可见
  不可评（登录引导），分页加载。`/api/comments` 进入 STRICT_PATHS 限流。
- **游客模式产品化**：`/reader` 未登录时阅读进度保存到本设备
  localStorage（键随资源隔离），下次打开续读；阅读器顶部新增游客模式
  提示条（登录后跨设备同步）。登录用户行为不变（服务端同步）。
- 首页新增「参与社区」板块：评论互动 / 进度同步 / 投稿开放 / 读者活动
  （年度 Rubbish Prize 读者票选）四卡 + 注册引导。投稿本就开放给全部
  登录用户（无需申请作者角色），文案同步说清。
- **论文排版对标真实期刊**：7 篇在线论文 PDF 全部重排——每篇 2 幅图
  （折线/柱状/饼图，reportlab 内置图表）+ 1 张三线表 + 中文图注/表注，
  覆盖奶蛙叙事、食堂排队、摸鱼博弈、自评估框架与创刊三示例。

### Fixed

- **RLS 覆盖门禁两处失真**（tests/test_rls_coverage.py）：检测器此前
  识别不了 003 的启用写法（元组 + f-string），门禁一直处于 skip；
  现已修复并激活，规则改为"全局覆盖 + 初始迁移后同文件"双不变量。
- **audit_logs 缺失 RLS**（真实隔离缺口，被上述失真掩盖）：迁移 007
  补齐 `audit_logs` 的 tenant_isolation 策略（应用层本就显式过滤
  tenant_id，无行为回退）。

## [0.5.0] — 2026-10-24

### Changed

- **许可证更换**：AGPL-3.0-or-later → **PolyForm Noncommercial 1.0.0**。
  定位调整：开源是让人学习与非商业复用，不是让人拿去做生意——商用、收费
  服务、捆绑进收费产品一律不允许（`LICENSE` 全文 + `NOTICE.md` 说明）。
  README 双语徽章、`pyproject.toml`、`package.json` 同步更新。
- **指标体系改版（口径收紧）**：公开响应不再返回 `r_index_formula`（公式
  与权重收归编辑部内部口径）；新增期刊级 **R 因子**（全刊 R 指数均值，
  两位小数）、`self_citation_rate`（恒 0.0，诚实栏位）、
  `absurdity_index_median`。`/journal-metrics` 页重做：旗舰数字卡 +
  指标一览 + 口径保密声明，首页指标区同步去掉公式块。
- 阅读器公开化：`/reader/{id}` 不再强制登录（已发表论文文件端点本就匿名
  开放）；阅读进度同步按登录态降级，访客阅读不再被登录墙挡住。

### Added

- **荒诞指数**：`resources.absurdity_index`（迁移 006，0–10 编辑部评定，
  可空）。公开响应暴露；admin PATCH 可改（越界 422）；目录表格/移动卡片/
  首页卡片/详情页显示等级徽章（正经 / 轻诞 / 荒诞 / 离谱）；管理端
  「编辑题录」对话框新增荒诞指数与刊出状态（draft/in_review 刊出）字段。
- **内容页三件套**：`/authors`（作者指南：双轨收录、收录标准、发表要求
  与"我们不要求"清单、格式模板下载、评审流程）、`/policies`（开放获取、
  学术诚信、荒诞内容声明、社区规范、撤稿、隐私、评审保密）、`/about`
  （定位、编委会、刊史、出版信息）。侧边栏与移动端"更多"新增「期刊」组。
- 投稿模板：`public/templates/` 提供 Markdown 与 LaTeX 两套模板下载。
- `help.html` 入库（`apps/frontend/public/`），开源部署开箱即用；页面头部
  链接新内容页。首页 meta description/OG/JSON-LD（Periodical）补齐。
- 目录列表 `has_file` 修复：此前恒为 false，现在列表行如实标注 PDF 可
  下载（一次 IN 查询整页判定）；目录与首页卡片出现 PDF 标识。
- 首页骨架屏加载态、返回顶部按钮；生成式封面组件（确定性渐变，零资源）。

### Fixed

- mypy：`_can_preview_unpublished` 的 `tenant_id` 参数标注 int → UUID
  （0.4.0 引入的潜在类型错误，运行时行为不变）。

## [0.4.2] — 2026-10-24

### Changed

- 首页改版（国际期刊门面）：去除全部 3px 双线分隔横线（以留白与底色差分节、
  深色页脚收底）；刊头升级为展示级衬线大字（新增自托管 Playfair Display
  可变字体，拉丁展示字形）+ 打字机轮播口号 + 数字滚动数据卡；最新发表由行式
  列表改为富卡片网格；投稿流程改为步进卡片；征稿/指南/FAQ/关于全部卡片化；
  全节滚动渐入 + 卡片悬停动效；导航改吸顶毛玻璃单发丝线。E2E 锚点
  （h1 "Rubbish"、banner 登录链接）保持不变。

### Added

- 管理端用户删除：`DELETE /api/admin/users/{id}`（admin 专用）。防护：
  管理员账号（含自己）不可删；目标 404 语义；users 全部外键为
  CASCADE/SET NULL，无 RESTRICT，删除安全；写入 `user.deleted` 审计
  日志（与删除同事务）。用于清理 e2e/smoke 测试账号。
- 管理员账号角色补齐：admin 增加 `author` 角色（此前仅 editor/reviewer）。

## [0.4.1] — 2026-10-23

### Changed

- 品牌图形标换代：`docs/assets/` 的 logo 家族（logo-mark / logo 徽章 /
  logo-horizontal 及两份反白版）由旧「书页之 S」字标全部重绘为与
  favicon、应用内 brand-mark 同几何的「印章之 R」（双线方框 + 衬线 R +
  金色菱形落款）；徽章保留双环、环带字标与底部引用星，横版字标不变。
- 宣传站（site/）标签页 favicon 此前渲染的是旧 S 字标，已替换为 R 印章
  圆形版；brand.html 品牌页的图形概念与用色叙事同步更新。

## [0.4.0] — 2026-10-23

### Added

- 刊前预览授权：`draft`/`in_review` 条目的详情与稿件文件向 editor 角色
  （含 admin）与关联投稿的作者本人开放；对其他访问者（含匿名）仍 404、
  不确认存在性；刊前预览不计入 R 指数下载量
  （`app/modules/catalog/routes.py`，tests/test_catalog.py 新增 3 例）。
- 录用暂存环节：`PATCH /submissions/{id}/decision` 新增可选
  `publication_status`（`published` 默认＝录用即刊，兼容旧行为；`draft`
  ＝暂存草稿）。录用→刊出之间出现「刊前整理」阶段，由 admin
  `PATCH /catalog/{id}` 刊出。投稿详情响应新增
  `resource_publication_status`，前端据实区分「已发表 / 刊前预览」
  （tests/test_submission.py 新增 2 例）。

### Changed

- 应用去展示化：明确「开源示例仓库 vs 正式上线生产服务」双定位——
  移除运行中应用内的「平台图集」板块、导航入口与截图资产
  （`public/shots/`，268K，仅图集引用）；展示性内容只保留在仓库
  `site/` 宣传页。README（中英）与 DEPLOY.md 按双定位重写陈述。

## [0.3.4] — 2026-10-23

### Added

- 仓库治理对齐 zcode 标准：根目录 `AGENTS.md`（工作纪律 12+ 节）、
  `.codebuddy/commands/` 四个命令程序（arch-review / review /
  security-scan / test-gap）、pre-commit 新增 `no-junk-files` 与
  `no-secret-files` 守卫钩子（等效 zcode cleanup-check / guard-write），
  逐条对照见 `docs/zcode-compliance.md`。

### Changed

- 二次验证 otpauth:// 发布方回退名由旧名 ScholarHub 改为 Rubbish
  （`app/api/two_factor.py` 的 `_issuer()`，该名称会显示在用户的验证器
  App 中）；`infra/Dockerfile.*` 注释同步清理。清理后
  `grep -ri scholarhub` 仅剩本文件对 0.3.3 清理动作的历史记录。

## [0.3.3] — 2026-10-23

### Changed

- 品牌残留清理：文档、环境变量示例、Docker/Caddy/wrangler 配置、媒体脚本与
  SVG 资产中的旧项目名全部替换为 Rubbish（`grep -ri scholarhub` 已归零）。
- 官网（GitHub Pages）改为从页面同源加载截图/logo/演示视频；部署 workflow
  会把 `site/` 与 `docs/assets/` 合成 `_site` 再发布，不再依赖
  raw.githubusercontent.com（国内网络下经常不可达）。

## [0.3.2] — 2026-10-23

### Security

- `certifi` 由 2026.10.18 升级并显式钉住到 **2026.10.19**（PYSEC-2026-4320，CI
  `pip-audit` 报出）。此前它只作为 httpx 的传递依赖被间接锁住，升级会被动落后。

## [0.3.1] — 2026-10-23

### Fixed

- CI：`bandit` 对 `xml.sax.saxutils.escape` 的 B406 误报加 `nosec` 说明（本模块
  只做文本编码，不解析任何 XML）；E2E 首页标题断言固定到 `h1`（「期刊指标」
  板块上线后页面出现第二个含 Rubbish 的标题）；阅读进度用例规避远端 PDF 加载
  回调把页码钳回 1 的竞态。

## [0.3.0] — 2026-10-23

项目更名为 **Rubbish**，定位收敛为"收录全球学术垃圾的开放获取期刊"，
视觉与评价体系对标 Science 的版面语言（刊名报头、双线导航、栏目化首页），
但**不照抄**其指标口径：本刊公布自算的 R 指数，不冒充影响因子。

### Changed

- **项目更名**：包名 `rubbish-backend` / `@rubbish/frontend`，环境变量前缀
  `RUBBISH_` → `RUBBISH_`，Cookie `rubbish_refresh`，日志命名空间
  `rubbish.*`，README/文档/官网/镜像链接全部指向 `*/rubbish` 仓库。
- **许可证由 MIT 改为 AGPL-3.0-or-later**：公益项目防止闭源商业分支回流，
  理由见 `NOTICE.md`。
- 首页新增「期刊指标」「平台图集」两个板块，导航扩到 9 项；图集为真实
  线上截图（WebP，268KB 总计）。

### Added

- **R 指数与学科分区**：`GET /api/catalog/journal-metrics` 公开自算指标，
  R = 100×(0.5×阅读归一 + 0.3×下载归一 + 0.2×收藏归一)，按学科最大值归一；
  分区 R1–R4 仅在学科样本 ≥4 篇时生成，否则返回 `null`（页面显示"样本不足"）。
- `resources.download_count` 列（迁移 005）+ 公开文件端点原子自增。
- `/journal-metrics` 页面：公开公式、口径、样本限制与机器可读端点。
- 文章详情页新增「阅读与影响」卡片（R 指数/分区/阅读/下载/收藏）。
- 首页图集使用 `whileInView` 逐格淡入 + 悬停缩放，遵循 `prefers-reduced-motion`。

### Fixed

- 目录创建/更新遇到唯一约束冲突时不再一律报"Slug 已被占用"，按实际冲突
  字段返回 DOI 或 Slug 的具体提示。

## [0.2.3] — 2026-10-22

### Security

- **公开面不再泄露未发表记录**：目录列表/详情/统计/分面统一按
  `publication_status == "published"` 过滤，匿名与非管理员访问草稿一律 404；
  管理员工作台不受影响。Meilisearch 相关性结果回读时套用同一过滤。
- **OAI-PMH 只收割已发表记录**：ListRecords / GetRecord 增加 published 过滤，
  与文件端点的授权边界对齐。
- `/metrics` 默认关闭（`RUBBISH_METRICS_PUBLIC=false`）：该端点无鉴权且会
  暴露全部路由模板与流量规模。

### Added

- **期刊门面首页**：新增本期导读、征稿范围、评审流程、开放获取与长期保存、
  作者指南、常见问题、编辑部联系方式；导航同步扩展。
- **抓取面**：`/robots.txt`、`/sitemap.xml`（仅已发表条目），SPA 兜底路由按
  路径注入独立 `<title>`、description、Open Graph、JSON-LD 与 Google Scholar
  `citation_*` 标签；未知文章返回 `noindex`。
- **能力探测端点** `GET /api/capabilities`：前端据此判断邮件是否真的会送达。
- 文章详情返回 `has_file`，仅在存在可下载稿件时显示「下载 PDF」。
- 详情页与推荐页的「加入阅读列表」改为真实功能（选择列表或现场新建）。

### Changed

- **邮件文案不再说谎**：console 邮件后端下，注册直接进入工作台，忘记密码页
  明确提示联系编辑部；仅在 SMTP 接通后才提示「请查收邮件」。
- 目录条目语言默认值 `en` → `zh`；详情页语言、类型、状态改为中文展示，
  推荐理由由内部诊断串改为可读文案。
- 隐私政策改为独立中文 HTML 页面，联系方式更正为 admin@argjiemi.cn。
- Cookie 横幅中文化并修正「可选 Cookie 用于 CSRF」的误导表述。
- 帮助页品牌统一为 Rubbish。
- `uv.lock` / `package-lock.json` 恢复官方 registry 地址。

### Fixed

- `apps/backend/app/modules/submission/routes.py` 拆分为作者/编辑/文件三个模块
  （52KB → 349 行入口 + 2 个职责文件），路由注册顺序保持不变。
- 新增 OAI-PMH 4 个测试与 SEO/能力探测 6 个测试、目录草稿可见性 3 个测试。

## [0.2.2] — 2026-10-18

安全加固版本，修完全部 9 项 P0 级安全问题。

### Changed

- **依赖树全量升级到最新**：后端 `uv lock --upgrade`（websockets 17.2、typer 0.27.3、
  mako 1.4.3、watchfiles/uvloop/wcwidth/typing-inspection 等；fastapi 0.139、
  pydantic 2.13.4、SQLAlchemy 2.0.51、alembic 1.18.5 此前已是最新不变）；
  前端 npm 依赖全量升级（react 19.3.1、vite 8.3.4、@sentry/react 11.8.0、
  vitest 5.0.5、playwright 1.64.1、eslint 10.13、axios 1.20.0、radix/tailwind 系列），
  TypeScript 保持在 5.x（TS 7 为原生编译器预览线，生态未就绪，按计划排除）。
- **Sentry JS SDK v11 适配**：`sendDefaultPii` 配置项在 v11 中移除（PII 默认即被剥离），
  删除 `src/lib/monitoring.ts` 中的该字段。
- **vitest 5 测试适配**：`src/lib/__tests__/api.test.ts` 的模块加载时机调整为用例内
  `vi.resetModules()` + 动态 import——vitest 5 中 beforeAll 期间产生的 mock 调用不会
  保留到用例执行阶段；同时将 4 处 `if (!interceptor) return` 假绿守卫改为硬断言
  （`expect(...).toBeTypeOf('function')` + `if (!x) throw` 类型收窄）。
- **移除 next-themes 依赖**：其 ThemeProvider 内部无条件渲染一个 inline `<script>`
  （ThemeScript 组件）。在纯 client-render 的 Vite SPA 中该 script 永远不会执行，
  React 19.3 起 dev 模式还会告警 "Encountered a script tag while rendering React
  component"，且 index.html 的 CSP `script-src 'self'` 会直接拦截 inline script
  （线上同样报 CSP violation）。改为自研的极简 ThemeProvider
  （localStorage 持久化 + matchMedia 系统偏好 + 多标签同步 + class 切换），
  首屏防闪烁沿用 `public/theme-bootstrap.js` 外链脚本；修复后移动端 5 个 E2E
  用例的 console 零报错断言恢复通过，全量 68 个 E2E 全绿。

### Added

- **编辑端双盲匿名稿链接 UI**：后端 `PUT /api/submissions/{id}/anonymized-file`
  此前只有 API、没有任何前端入口，编辑只能直接调接口才能为双盲评审提供匿名稿。
  现在编辑工作台（`/submissions/pending`）每张卡片新增「匿名稿」按钮与弹窗：
  可填写 http(s) 匿名稿外链或清除已有链接，并明确提示服务端不具备剥离 PDF
  元数据的能力（需由编辑确认匿名稿本身不含作者姓名与单位）。前端类型同步补上
  `anonymized_file_url`，并新增 `useSetAnonymizedFile` mutation。

### Security

- **双盲绕过 v2 修复（P0-4 加固）**：审稿人文件端点在双盲下曾把审稿人 302 重定向到
  `download_url`，但该字段**完全作者可控**（创建端点与作者编辑端点均可写）——
  作者填一条带身份的 URL 即可直穿双盲（重定向目标对审稿人可见，页面内容更可直接
  暴露姓名单位）；审稿人视角的 JSON 序列化同样保留了作者可控的
  `download_url`/`external_url`（原注释假设其为"编辑提供的匿名稿"，与控制面不符）。
  现新增**编辑专属**列 `submissions.anonymized_file_url`（迁移 `d4e5f6a7b8c9`），
  只由编辑端点 `PUT /api/submissions/{id}/anonymized-file` 写入：
  - 双盲 + 审稿人取稿件：只放行到编辑提供的匿名稿外链，否则 403 并提示编辑补传；
  - 双盲审稿人 JSON：`download_url`/`external_url` 抹除，作者可控链接不再流出；
  - 作者编辑端点的 schema 不含该字段，作者无法经编辑通道写入。
- **P0-1 移除 `/uploads` 静态挂载**：此前投稿上传的 PDF 以零鉴权静态目录对外提供，
  任何匿名/跨租户用户拿到 `/uploads/<uuid>.pdf` 即可下载**未公开稿件**，
  完全绕开 `GET /api/submissions/{id}/files` 的作者/编辑/审稿人鉴权。
  现在稿件文件只经鉴权端点流出；已发表文章改走新增的公开端点
  `GET /api/catalog/{id}/file`（只有进入公开目录的资源可读）。
- **P0-2 PostgreSQL RLS 真正落地**（迁移 `c5a3e91b7d20`）：19 张租户表全部
  `ENABLE` + `FORCE ROW LEVEL SECURITY` 并建 `tenant_isolation` 策略。
  此前迁移里一条 RLS 语句都没有，文档宣称的"隔离第二层"并不存在。
  配套修复 bootstrap 的 GUC 时序（改为两段会话，否则启动即 500）。
  已在 PostgreSQL 17 上实测：无 GUC 时 fail-closed、跨租户读写双向隔离。
- **P0-3 DOI 不再撞号**：默认后缀改为 `{resource_id}-{tenant_id 前 8 位}`
  （原为全局自增 id，多租户下必然重复）；后缀加 `^[A-Za-z0-9._-]+$` 校验；
  迁移 `b7f1c0d2a934` 为 `resources.doi` 与 `doi_registrations.doi` 补唯一约束。
- **P0-4 双盲评审不再被击穿**：双盲下审稿人不再拿到原始 PDF（含作者姓名单位），
  只放行编辑显式提供的匿名稿外链，否则明确报错由编辑补传。
- **P0-5 编辑机密收口**：审稿人只能读取**自己**那份报告的 `comments_to_editor`，
  此前任何有 assignment 的人（含仅受邀未接受者）都能看到全部报告的机密评论。
- **P0-6 修复登录开放重定向**：`?redirect=` 现在只接受站内相对路径
  （`safeInternalPath`），杜绝"登录成功→跳钓鱼站"。
- **P0-7 CSRF cookie 下发接线**：`_ensure_csrf_cookie` 原为死代码，开启 CSRF
  后所有写请求必然 403；现在在安全方法响应中下发。
- **P0-8 CSP 与边缘安全头**：`frame-src` 改为 `frame-ancestors`（前者方向相反，
  根本没防住点击劫持），补 `base-uri`/`form-action`；根 `Caddyfile` 补齐此前
  完全缺失的安全响应头。

### Tests

- `test_doi.py` 中固化了旧（撞号）后缀格式的断言已更新为租户维度格式。

### Fixed

- **DOI 撞号治理加固**：`POST /api/doi/register` 的自定义后缀此前只与**当前资源**的
  doi 列比对，复用另一资源已铸出的后缀会把铸造请求发往 DataCite、污染永久标识元数据，
  最后才在 commit 时撞唯一约束（500）。现在铸造前先查 `doi_registrations` 全局撞号
  → 409 且不打扰 DataCite；并发/预检漏过场景由 commit 的 IntegrityError → 409 兜底，
  目标资源 doi 列保持未设置。
- **公开文件端点纵深防御**（P0-1 加固）：`GET /api/catalog/{id}/file` 此前只校验
  资源存在，未校验 `publication_status`。编辑在"接受"投稿时可以把稿件对接到
  任一带 `resource_id` 的现有条目，若该条目为 draft/in_review，未公开稿件仍可
  经此公开端点匿名流出。查询现已加 `publication_status == "published"` 过滤，
  并补 4 个回归测试（published 200 / draft 404 / in_review 404 / 无文件 404）。
- **存储文件清理（孤儿对象治理）**：删除 pending 稿件与替换式上传此前都不清理
  存储后端（本地磁盘 / S3）中的旧文件，导致删除稿件后仍残留 PDF、重复上传无限
  累积孤儿对象，既造成存储泄漏，也留下"已删数据"的残留痕迹。现在
  `DELETE /api/submissions/{id}` 在删除记录后 best-effort 清理 `file_path` 对应
  文件；替换式 `POST /api/submissions/{id}/files` 在覆盖 `file_path` 前清理旧文件
  （uuid 碰撞兜底跳过自删）。清理失败仅告警、不阻断主流程。补 2 个回归测试
  （替换上传清旧文件 / 删除稿件清文件）。
- **CI 依赖锁同步**：`uv.lock` 未随 `pyproject.toml` 更新，导致 GitHub Actions 后端/迁移/安全/e2e 四个 job 全部失败于 `uv sync --locked`。重新生成锁定文件，`setup-uv` 升级到 0.13.1 与锁生成器一致。
- **Ruff lint/format**：修复 `bootstrap.py` 导入排序（I001）与 `catalog/models.py`、`doi/schemas.py` 格式问题，本地 642 测试通过。
- **GitHub 分支保护规则中移除不存在的幽灵检查项** `Scan for secrets`（该检查无对应 workflow，导致直接推送死锁），替换为 CI 实际产出的 8 个检查。
- **存储清理 helper 的打日志方式回正**：上次修复随 PR rebase 进入核心仓库，但真源 gitcode 的原始提交漏带了 lint/mypy 两处修正——`import logging` 位置错误（I001）、`logger.warning(..., key=key)` 不是标准 logging 的合法 kwarg（存储删除失败时实际会抛 `TypeError` 盖过主流程）、无用的 `# noqa: BLE001`（RUF100）。三处修正现已 cherry-pick 回真源，与核心仓库对齐。
- **限流器 circuit breaker 不再永久断开**：`RedisRateLimiterStore` 的熔断标志一旦置位，旧代码此后所有请求都短路到内存回退，**Redis 恢复后永远不会再被使用**——限流退化回单副本计数，与熔断注释宣称的"下次请求自动恢复"直接矛盾。现在熔断带冷却时间：冷却内走内存回退、不重复探活，冷却后首个请求探测 Redis，成功即重新 wire Redis 路径（多副本重新共享计数）。
- **内存限流桶不再无限驻留**：`MemoryRateLimiterStore` 此前只清理单个 key 内部的过期时间戳，bucket key 本身（`IP|路径桶`）一旦创建就永久驻留——换 IP 扫描的请求会让 `_buckets` 无界增长。现在 hit_and_check 内以低频率全图清扫（默认 60s 一次，删除最新条目老于 10 分钟的 key；最长配置窗口仅 60s，活桶不可能被误删）。
- **2FA pending token 获得密钥轮换兼容**：`create/decode_two_factor_pending_token` 此前绕过 `key_rotation` 直接用当前密钥签/验，注释却声称"hot reload 到达验签"——轮换后旧密钥签发的 pending token 立即失效，正好落在"密码步已过、验证码步失败"的登录半途。现在统一走 `encode_jwt`/`decode_jwt(expected_type=...)`：kid 头 + previous keys 回退，type 不符仍拒绝，不给攻击者猜测 type 的空间。
- 五平台镜像同步为 append-only/强制对齐两种模式治理：镜像（Morningstar202604、X33834、gitee）与核心 badhope 保持内容一致。

## [0.2.1] — 2026-10-18

### Changed

- **许可证由 Apache-2.0 改为 MIT**（`LICENSE` 全文替换，删除 Apache 专用的 `NOTICE`，
  同步更新 `README.md` / `README.zh-CN.md` 徽章、`SUPPORT.md`、`apps/backend/pyproject.toml`
  与官网 `site/` 页脚）。MIT 对商业托管与二次分发更友好。

### Fixed

- 恢复 `.github/workflows/ci.yml` 与 `.github/workflows/deploy-site.yml`：此前两个工作流被误删，
  导致 GitHub 主仓库（badhope，核心仓库）完全失去 CI 门禁。

### Removed

- 删除与 `VERSION` 矛盾的 `v1.0.0` 轻量标签（它实际指向一个 Dependabot 配置提交，
  而当时版本是 0.2.0）。标签一律使用附注标签（`git tag -a`），并与 `VERSION` 三段完全一致。

### Housekeeping

- 明确仓库主从关系：**GitHub/badhope 为核心仓库**，GitCode、Gitee、X33834、Morningstar202604
  均为只读镜像，禁止在镜像上直接提交（此前在镜像上手工提交导致五平台 HEAD 全部分叉）。
- 五平台对齐统一走 `rubbish-sync-all`（平台间 3 秒间隔，分叉时用 `--force`）。

### Known issues

- 演示视频与官网截图仍为旧版（含历史遗留的大文件），待本轮问题修复完成后统一重新生成并替换。
- 演示视频与官网截图仍为旧版（含历史遗留的大文件），待本轮打磨完成后统一重新生成并替换。
- 代码审计发现的 P1（31 项）与 P2（约 55 项）尚未处理，后续按优先级排期。

## [0.2.0] — 2026-09-14

- 部署指南、治理模板、版本守门脚本落地。
- 迁移收敛为单个初始迁移（`3392b958c074_001_initial_schema`）。
- 三平台 CI、依赖锁定、官网中英文切换。

## [0.1.0] — 2026-09-02

- 首个可运行版本：投稿、评审、目录、阅读器主链路。
