# FabulousProgram

FFFabulous Robotics · FTC 19726 的 Java 和机器人编程课程平台。正式网站访问 [FabulousProgram](https://program.fffabulous.top)。本地默认只监听 `127.0.0.1:19726`。

## 本地启动

需要 Node.js 22 或更新版本和 JDK 21。可用 `FP_JAVA_HOME` 或 `JAVA_HOME` 指定 JDK。macOS 若由 Homebrew 安装且 `java_home -v 21` 找不到 JDK，请将变量指向该 JDK 的 `Contents/Home`。Windows 也可用 `启动网站.cmd` 启动。

1. 如需启用 Beta8397 仿真，先执行 `npm run build:beta`。
2. 首次建站时指定 `FP_BOOTSTRAP_OWNER` 和 `FP_BOOTSTRAP_PASSWORD`，再执行 `npm start`。用户名须为 3–20 位字母、数字或下划线，密码须为 10–200 位。首次初始化会保存密码哈希，后续启动可以清除这两个变量。部署已有站点时直接指定已有数据目录。
3. 打开 `http://127.0.0.1:19726`。新库初始化 W1 和基础资料。补充周次使用下述维护命令。独立测试实例请指定不同的 `PORT` 和 `FP_DATA_DIR`。

课程资料支持 PDF 和 DOCX。内置阅读版来自 `course/previews/manifest.json`，与原文档按 SHA-256 匹配。上传的 DOCX 可由 LibreOffice 转换，使用 `FP_SOFFICE_PATH` 指定可执行文件，或在 `PATH` 中提供 `soffice`。

## 模块

| 位置 | 职责 |
| --- | --- |
| `src/server.mjs` | 启动、端口绑定、共用鉴权入口和请求分发 |
| `src/store.mjs` | 数据格式迁移、串行持久化和课程定时发布 |
| `src/routes/` | 账号、课程进度与草稿、交卷、编译仿真、后台管理接口 |
| `src/course-structure.mjs`、`src/materials.mjs` | 周次及权限、课程资料与预览 |
| `src/learning-results.mjs`、`src/member-progress.mjs` | 判分、历史成绩与进度统计 |
| `src/judge.mjs`、`src/beta.mjs`、`judge-src/` | Java 判题、FTC 模拟器与分项测试 |
| `public/` | 页面导航、练习和资料视图、结果组件与浏览器编辑器 |
| `course/` | 教案、可复用题库、教学参考程序与测试数据 |

## 课程维护

导入会保留已保存的课程和学习记录。W1 由初始课程配置提供。W2、W5、W6 有显式导入脚本。先运行 `npm run import:w2`、`npm run import:w5` 或 `npm run import:w6` 预览。写入前停止使用同一数据目录的后端，再加 `-- --apply --server-stopped`。W5 和 W6 可同时加 `--publish`。W4 可用 `npm run preview:w4` 启动独立练习预览。

W5 共八套题库。导入时用 `FP_W5_ASSIGNMENTS` 指向仓库外的 JSON 文件，键为题库标识，值为启用成员的用户名数组。八个键为 `bottle`、`photo`、`light`、`counter`、`echo`、`sound`、`planner`、`station`。导入后，课程按不可变用户 ID 授权。课程原有的判分规则、交卷次数和分卷关系随站点数据保存。

## 正式站与数据

账号、成绩、提交代码、会话、分卷记录和上传资料由 `FP_DATA_DIR` 指定。维护时备份该目录和 LaunchAgent 配置。仓库内 `data/` 只跟踪目录占位文件，测试会生成独立的虚构账号和数据。站点资料也可用 `FP_COURSE_DIR` 指向已有的课程资源目录。

macOS 使用 `npm run service:install` 安装或更新本站的 LaunchAgent。部署已有站点时，设置 `FP_DATA_DIR`，按需要设置 `FP_COURSE_DIR`、`FP_JAVA_HOME`、`FP_SOFFICE_PATH`。安装脚本将这些路径写到本机服务配置。Cloudflare Tunnel 使用 IPv4 回环地址 `127.0.0.1:19726`。定期检查后台身份和健康状态，连续三次失败会由本站保护进程重启后台，间隔至少五分钟。日志在 `~/Library/Logs/FabulousProgram/`。

## 验证与依赖

- `npm run check` 检查自有 JavaScript 源码，`npm test` 验证登录、作答、草稿与权限隔离。
- `npm run test:exercise`、`npm run test:w2`、`test:w4`、`test:w5`、`test:w6`覆盖已有教学规则和分卷。
- `npm run test:beta-api` 验证仿真会话，`npm run test:service` 验证端口及健康保护。
- FTC SDK 依赖与许可见 `sdk/NOTICE.md`，Beta8397 及 OpenJFX 见 `vendor/BETA8397-NOTICE.md`。JavaFX 和仿真编译产物按本机运行环境配置。
