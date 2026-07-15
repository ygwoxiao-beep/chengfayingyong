# 源页 → 步骤映射（乘除法应用题初步）

- 转换模式：**interactive conversion**（数据驱动，SCORM 2004）
- 源：`assets/pages/page-01.png` … `page-27.png`（按文件号排序）
- 结构：左侧目录（TOC）＋ 右侧主课件区，自适应电脑 / Pad / 手机

| 文件 | 页序 | 标题 | 类型 | 交互原语 | 正确答案 |
|---|---|---|---|---|---|
| page-01 | 1 | 封面：乘除法应用题初步 | cover | 点击出现 | — |
| page-02 | 2 | 模块一 乘法应用 | divider | — | — |
| page-03 | 3 | 例一 兔子 | interaction | 拖拽（drag-formula） | 4×3=12 |
| page-04 | 4 | 例二 篮球+鸡腿 | interaction | 图片热点＋放大镜＋填空 | 5×8+7×7=89 元 |
| page-05 | 5 | 例三 河豚船 | interaction | 连线（matching） | ①→C ②→B |
| page-06 | 6 | 模块二 除法应用 | divider | — | — |
| page-07 | 7 | 例四 胡萝卜 | interaction | 排序（sequence） | 18÷3=6 |
| page-08 | 8 | 例五 大米/苹果 | interaction | 连线（matching） | ①→A ②→B |
| page-09 | 9 | 登峰造极 和尚馒头 | interaction | 填空 | 7×2+6÷2=17 |
| page-10 | 10 | 知识点睛 | interaction | 多选＋点击出现 | o1,o2,o4 |
| page-11 | 11 | 大展身手 | divider | — | — |
| page-12 | 12 | 练习1 公园的花 | interaction | 单选 | 7×9=63 |
| page-13 | 13 | 练习2 小兔摘花 | interaction | 填空 | 24÷3=8 |
| page-14 | 14 | 练习3 篮球足球 | interaction | 填空（含干扰项） | 27÷9=3 |
| page-15 | 15 | 练习4 奶牛荷叶 | interaction | 连线（matching） | ①→A ②→C |
| page-16 | 16 | 练习5 煮汤圆 | interaction | 填空 | 5+3+8+7+6×6=59 |
| page-17 | 17 | 厚积薄发 | divider | — | — |
| page-18 | 18 | 练习1 买狗粮 | interaction | 填空 | 9×4=36 |
| page-19 | 19 | 练习2 小美吃苹果 | interaction | 填空 | 5×7−20=15 |
| page-20 | 20 | 练习3 蒸馒头 | interaction | 填空 | 40÷5=8 |
| page-21 | 21 | 练习4 采购彩笔 | interaction | 填空 | 9×8=72 |
| page-22 | 22 | 练习5 分篮球 | interaction | 填空（含干扰项） | 18÷6=3 |
| page-23 | 23 | 练习6 买苹果 | interaction | 填空 | (50−2)÷6=8 |
| page-24 | 24 | 练习7 划船租船 | interaction | 填空（两空） | (14+6)÷4=5；5×8=40 |
| page-25 | 25 | 练习8 拔萝卜 | interaction | 判断 | 48÷8=6（对） |
| page-26 | 26 | 练习9 桃梨分盘 | interaction | 填空（两空） | 桃19；梨14 |
| page-27 | 27 | 练习10 桃梨分篮 | interaction | 填空（两空） | 每篮桃2；每篮梨7 |

## 覆盖的题型（8 种，均支持提交 / 即时反馈 / 正确·错误动画 / 再试一次 / SCORM 上报）
单选、多选、填空、连线、拖拽、判断、图片热点、排序。

## 课堂互动效果
点击出现、放大镜、聚焦高亮、奖励动画（撒花＋星星）、鼓掌/答对音效（WebAudio 合成，无需外部音频文件）、页面切换动画。

## SCORM 上报字段
学习进度（progress_measure）、页面浏览（suspend_data.viewed）、作答记录（cmi.interactions）、
学生答案（learner_response）、得分（score.raw/scaled）、完成状态（completion/success_status）、学习时长（session_time）。

## 预览
必须通过 HTTP 预览（数据用 fetch 加载）：
```
cd 乘除法应用题初步
python3 -m http.server 8899
# 打开 http://localhost:8899/index.html
```
