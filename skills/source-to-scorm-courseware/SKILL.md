---
name: source-to-scorm-courseware
description: Convert PPT, PDF, lesson notes, images, and other teaching materials into SCORM 2004 courseware packages. Use when the user asks to turn source teaching files into LMS-uploadable courseware, preserve teaching flow, add interactions, package imsmanifest metadata, or adapt a web course into SCORM format.
disable-model-invocation: true
---

# Source To SCORM Courseware

## Goal

Turn source teaching material into a SCORM-ready package that can be uploaded to an LMS and still feel like a modern interactive web lesson rather than a static slide deck.

## Default Output

Unless the user says otherwise, structure the result like this:

```text
course-name/
├── index.html
├── scorm-api.js
├── imsmanifest.xml
├── data/
│   ├── lesson.json
│   └── questions.json
├── assets/
│   ├── pages/
│   ├── audio/
│   └── videos/
└── analysis/
```

Use `lesson.json` for course flow and global metadata. Use `questions.json` for interaction definitions.

## Workflow

### 1. Analyze the source

Identify:

- course title, audience, lesson objective
- page/slide order
- media assets: images, videos, audio
- points that should become interactions instead of passive reading
- whether the final output must be SCORM `1.2` or `2004`

If the source is mostly static, do not blindly preserve every slide as-is. Convert slides into learning steps.

### 2. Choose the conversion mode

Pick one of these and state it before implementation:

- `light conversion`: mostly page display, minimal interactions
- `interactive conversion`: multiple question types, progress, scoring, feedback
- `game-like conversion`: stronger animation, sound, rewards, replay loops

Default to `interactive conversion`.

### 3. Separate content from rendering

Do not hardcode all lesson content directly into `index.html`.

Prefer:

- `lesson.json`: title, sections, flow, cover, scoring rules, report config
- `questions.json`: per-step interaction config, correct answers, feedback copy

This keeps the course maintainable and lets later lessons reuse the same shell.

### 4. Build the web lesson first

SCORM is a wrapper around a web course. First ensure the web lesson works well on its own:

- responsive layout
- readable content density
- click/drag/input interactions
- success/failure feedback
- progress display
- final report or completion state

Do not treat SCORM packaging as a substitute for product quality.

### 5. Add SCORM runtime integration

Implement a thin runtime layer that:

- detects `API_1484_11` for SCORM 2004
- detects `API` for SCORM 1.2
- falls back to `localStorage` for local preview
- saves location, score, completion, success status, progress measure, suspend data

Local preview should work without an LMS.

### 6. Create `imsmanifest.xml`

Ensure:

- correct schema and edition
- one launchable SCO unless the user explicitly needs multiple SCOs
- `href` points to `index.html`
- file entries match the packaged local assets

If a video uses an external URL for direct playback, do not list it as a local packaged file.

### 7. Handle media intentionally

Default rules:

- images: package locally
- small audio effects: package locally if used often
- large videos: prefer external CDN links when the LMS and network environment allow it

For external media, explicitly check:

- hotlink restrictions
- CORS behavior
- LMS environment network access

### 8. Validate preview correctly

Never validate with `file://index.html` if the lesson uses `fetch()` for JSON.

Always preview over HTTP, for example:

```bash
python3 -m http.server 8899
```

Then open:

```text
http://localhost:8899/index.html
```

### 9. Package for delivery

Before packaging:

- preview flow end to end
- verify every referenced local file exists
- verify progress and score persistence
- verify the last step reaches completed status

When the user needs LMS delivery, zip the package with `imsmanifest.xml` at the root.

## Quality Gates

Before considering the work done, verify:

- [ ] the lesson can run locally over HTTP
- [ ] the lesson still works when SCORM API is absent
- [ ] content is data-driven, not only hardcoded in HTML
- [ ] interactions match the teaching objective, not just decoration
- [ ] external media links are playable without forced download
- [ ] `imsmanifest.xml` matches actual packaged assets
- [ ] mobile and narrow-width layout remain usable
- [ ] completion, score, and suspend data are saved

## Interaction Guidance

Prefer interaction types that map naturally from source material:

- visual spotting -> click targets / overlay hotspots
- pattern completion -> drag to slots / grid fill
- arithmetic reasoning -> input / multiple choice
- ordered process -> step path / sequence challenge
- recap -> multi-round mixed challenge

Use richer feedback when the lesson is exploratory or game-like:

- correct: visible celebration + positive sound
- wrong: clear retry feedback + automatic reset if appropriate

## Common Failure Modes

- trying to preview with `file://` and assuming data is broken
- packing remote video paths into manifest as if they were local files
- converting every slide literally instead of redesigning for interaction
- hardcoding lesson data into the page shell
- forgetting LMS completion fields even though UI progress looks correct

## Response Pattern

When asked to do this work, answer in this order:

1. state the chosen conversion mode
2. summarize the source breakdown
3. outline the interaction plan
4. implement the web lesson
5. add SCORM packaging and validation
 
## 生成逻辑与注意要点（精炼）

下面为可复用的生成课件流水线与关键注意点，复制至其他课件制作流程时请保持一致性与可追溯性。

1) 总体流水线（可复用）
   - 分析源文件：提取课程标题、目标受众、教学目标、页序、媒体依赖、潜在交互点、首选 SCORM 版本（1.2 / 2004）。
   - 确定转换模式（必须在回复中声明）：`light conversion` / `interactive conversion`（默认）/ `game-like conversion`。
   - 内容抽取并建模：把页面内容和交互点映射到数据模型（lesson.json、questions.json）；避免把内容直接写到 index.html。
   - 设计浏览器步骤：将原始幻灯片拆解为 Cover → 讲解 → 引导交互 → 练习轮 → 汇总/报告。
   - 实现可复用 shell：交互原语复用（见下），样式与脚本独立于数据。
   - 本地预览与自动化校验：HTTP 服务预览、检查 manifest 与本地文件一致性、无 LMS 时本地降级（localStorage）。
   - 打包为 SCORM：生成 imsmanifest、文件清单、打包 zip 并验证入口可启动。

2) 交互映射规则（从源到原语）
   - 视觉寻找 -> 点击热点 / 覆盖提示
   - 填空或序列 -> 拖拽到格子 / 顺序拼接
   - 算术或文本校验 -> 文本/数字输入 + 多选作为兜底
   - 复习环节 -> 多轮混合挑战（保证错题可重试）
   - 优先使用内置原语：click choice、hotspot、drag-slot、grid-fill、sequence、number-input、multi-round

3) 数据模型约定（必有项）
   - lesson.json（至少包含）：id、title、author、version、cover、flow（每步 id、type、contentRef）、scoring规则、reportConfig
   - questions.json（每步交互）：stepId、interactionType、prompt、options、correctAnswer、feedback{correct,incorrect}、retry规则
   - 文件命名与版本：course-slug_v{semver}.zip，内部 lesson.json 标注 version 与 generatedBy（脚本/人工）

4) 资源与媒体策略
   - 图片：优先本地（尽量 ≤300KB），需要时生成 webp 与 png 两套
   - 音频：短效果本地，讲解类音频可本地或稳定外链
   - 视频：优先外链 CDN（若 LMS 环境允许），切勿将大视频当作本地文件写入 manifest
   - 资源引用：在 lesson.json 中使用相对路径，构建打包前校验每个文件存在

5) SCORM 专项注意
   - API：检测 API_1484_11（SCORM2004）与 API（SCORM1.2），实现通用适配层
   - 存储：保存 location、score、completionStatus、successStatus、suspend_data（可 JSON 化）
   - Manifest：通常只生成一个可启动 SCO（除非用户要求多个），确保 href 指向 index.html
   - 本地预览：当没有 LMS 时需回退到 localStorage，测试应覆盖两种模式

6) 校验与质量门
   - 用 HTTP 服务预览（不可用 file://）
   - 检查 imsmanifest 文件项与实际打包文件一致
   - 在无 SCORM API 的环境下仍能完整体验流程（progress、重试、报告）
   - 移动窄屏可用，交互目标宜触控友好
   - 外链媒体能直接播放且不触发下载提示

7) 可复用模板与自动化点
   - 提供 lesson.json / questions.json 模板（见下）
   - 将交互原语实现为可参数化组件，便于脚本化把 PPT → JSON 的转换
   - 在生成脚本中保留映射日志，记录“源页 → 步骤 id”的映射关系，便于审校

示例（简化）lesson.json 结构：

```json
{
  "id": "course-slug",
  "title": "示例课程",
  "version": "1.0.0",
  "flow": [
    { "id": "cover", "type": "cover", "contentRef": "pages/cover.html" },
    { "id": "q1", "type": "interaction", "contentRef": "questions/q1.json" }
  ]
}
```

在执行后续课件制作时，请遵循以上约定以保证可复用性与可自动化生成能力。
