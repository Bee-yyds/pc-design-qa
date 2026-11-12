# 数据与证据规范

## 报告

data/report.json对应一个需求：schemaVersion=1、version、requirement、onlineUrl、batches。batches为按首次接收任务顺序正排的对象（追加新键到末尾，补验不重排），键是稳定批次ID。每批含 tab、title、source、link、modules、pending。pending仅用于内部记录及一致性校验，不渲染为在线页模块。

模块含 id、可选reviewOrder、title、figma、可选figmaMore、dev、design、marks、facts、issues、capture。issues项为 id、originalDescription，可选 evidence。复验发现同模块不同问题对应不同状态或时间时，为相关问题提供完整 evidence（dev、design、marks、capture及可选devDisplayWidth）；选中问题tab时使用其证据，未提供时沿用模块证据。保留已修复问题的原证据，不用新状态截图替换其他旧问题。capture.dev/design均含 width、height、capturedAt、state；dev另含dpr。尺寸对应实际文件，两state描述同状态。可选devDisplayWidth不能超过原图宽度/dpr。

facts仅用于内部验收依据，不渲染为在线页面区块或交付说明；修改所需的参数仍可写入问题描述。研发使用在线HTML，不提供本地HTML下载、导出或自动快照更新；原图、精确节点和可复制MCP提示词在在线页面提供。

顶部四项统计由全部batches.modules及其issues构成同一全量集合：模块数、问题数、研发已修复数、设计已确认数。状态计数仅按当前issues中的ID读取最新共享状态，已撤出ID不计入；tab、排序不参与统计范围。数据结构及状态API无需为全局统计增加字段或迁移数据库。

marks为[[1,x百分比,y百分比],...]，每个问题当前生效证据至少包含其局部序号；同一问题可在图上标两处以指明定位关系，标记值不得超出本模块问题编号范围。图片放public本地路径，不依赖临时远程地址；保留原图，CSS标记另层。推荐PNG，已有高质量JPG可用。

Figma链接须真实fileKey及node-id，优先子节点，多节点用figmaMore。每节点MCP提示词要求读参数及Development，不读关联评论；链接/提示词不传递授权。

## 验收排序

reviewOrder为正安全整数，与模块ID和原始数组位置独立。现有报告首次启用时，按原加入顺序初始化所有模块；新增或补验正式更新报告时，从整份需求当前最大序号加1开始，按本轮任务接收顺序逐个赋值。补验只改涉及模块的reviewOrder，不移动原数组、不重编号；编辑描述、备注和两个状态均不改该值。

显示模块按reviewOrder倒排；未修复模式先按模块是否含未修复问题分组，再倒排。旧模块缺少reviewOrder时兼容使用本批原数组序号，序号相同时后加入的在前。无hash、未知或无效hash使用首tab，有效hash选对应tab。

## 内部覆盖

验收覆盖清单.json：version、requirement、states。状态项含 id、batchId、name、figma、status、developmentNotes，可附 moduleId、reason、checkedAt。

status：confirmed-difference、no-difference、pending、needs-confirmation、excluded。确认差异指向模块，无差异不生成研发卡片；pending/needs-confirmation须原因并放批次pending（[状态名,原因]），供内部记录与校验使用。excluded记排除来源。覆盖、进度、未完成原因与附属说明均不展示为研发页面模块或MCP提示词；每轮按SOP在对话表格汇报。

## 协作与兼容

issue_state保存最新描述、备注、repaired、confirmed、revision、updatedBy/At；issue_history保存修改前后、操作者ID/邮箱、时间；originalDescription始终保留。历史展示分别比较description、handlingNote、repaired、confirmed，仅显示实际变更字段；两个状态分别展示，旧记录同样适用。无业务字段变化的旧条目不展示，不删除、不重编号。全未变更保存不增加revision或历史。数据库继续保留完整前后快照，无需迁移或更改API。

PATCH携带expectedRevision，不一致409返回最新状态并保留草稿，用户核对后重试。状态独立，未登录401、未知问题404。撤出ID不复用于其他问题。

## 校验

运行scripts/validate-report.mjs，传--report、--public-dir、--coverage；发布后加--published要求有效onlineUrl。校验ID、链接结构、图像尺寸、标记和覆盖关系，不代替同状态视觉检查、字体/批注读取及权限确认。历史行为使用 `node scripts/test-history.mjs <报告项目路径>` 在隔离内存数据上验证实际组件与PATCH处理器，不改线上状态。

排序隔离验证：`node scripts/test-order.mjs <报告项目路径>`，验证新模块与补验前移、状态独立、旧数据兼容、tab定位及编号/统计保留。
