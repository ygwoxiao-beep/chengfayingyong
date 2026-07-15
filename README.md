# 乘除法应用题初步 · SCORM 互动课件

## 项目说明
由 27 页课件图片转换而成的 **SCORM 2004 互动课件**，左侧目录 + 右侧主课件区，支持 8 种题型与 LMS 数据上报。

**Git 仓库：** https://github.com/ygwoxiao-beep/chengfayingyong

## 获取与更新

```bash
# 首次克隆
git clone https://github.com/ygwoxiao-beep/chengfayingyong.git
cd chengfayingyong

# 以后拉取最新版本
git pull
```

## 目录结构
```
├── index.html              主入口（左目录 + 右主区）
├── imsmanifest.xml         SCORM 2004 清单
├── scorm-api.js            SCORM 运行时（含 localStorage 降级）
├── css/{styles.css, viz-practice.css}
├── js/{app.js, effects.js, viz-practice.js}
├── data/
│   ├── lesson.json         课程流程与目录
│   └── questions.json      互动题配置
├── assets/pages/           27 张课件页图片（page-01.png … page-27.png）
└── analysis/mapping.md     源页 → 步骤映射日志
```

## 本地预览
必须使用 HTTP 服务（不能用 `file://` 直接打开）：

```bash
cd chengfayingyong
python3 -m http.server 8899
```

浏览器访问：http://localhost:8899/index.html

## 功能特性
- **27 页完整还原**：按文件号顺序排列，版式 16:9 自适应（电脑 / Pad / 手机）
- **8 种互动题型**：单选、多选、填空、连线、拖拽、判断、图片热点、排序
- **课堂互动**：点击出现、放大镜、奖励动画、答对/答错音效、页面切换动画
- **每题支持**：放大提交按钮、答对自动下一题、重来、看解析
- **SCORM 上报**：学习进度、页面浏览、作答记录、得分、完成状态、学习时长

## 打包上传 LMS

在项目根目录执行：

```bash
zip -r chengchufa-yingyongti-chubu_v1.0.3.zip \
  imsmanifest.xml index.html scorm-api.js \
  css/styles.css css/viz-practice.css \
  js/app.js js/effects.js js/viz-practice.js \
  data/lesson.json data/questions.json \
  assets/pages/page-*.png
```

将生成的 zip 上传到 LMS，`imsmanifest.xml` 须位于压缩包根目录。
