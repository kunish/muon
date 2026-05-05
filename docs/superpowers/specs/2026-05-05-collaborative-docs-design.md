# 飞书风格协作文档 - 架构设计

## 目标

为 Muon 添加对齐飞书的在线协作文档功能，支持实时协同编辑、富文本、评论与分享。

## 方案选择

**方案 B：Yjs CRDT + Matrix 传输层**

- Yjs 管理文档 CRDT 模型，自动解决编辑冲突
- Tiptap 通过 y-prosemirror 绑定 Yjs，实现协作编辑
- Matrix 房间作为文档协作通道，自定义事件传输 Yjs 增量更新
- 每个文档 = 一个私密 Matrix 房间

## 总体架构

```
Vue 3 前端
├── DocsPage (路由入口)
├── DocsSidebar (文档管理侧边栏)
├── DocEditor (Tiptap 协作编辑器)
├── CommentsPanel (评论面板)
└── ShareDialog (分享协作者)

Yjs 文档模型
├── content: Y.XmlFragment (ProseMirror 富文本)
├── title: Y.Text
├── comments: Y.Array
├── cursors: Y.Map
└── metadata: Y.Map

Matrix Sync Provider (Yjs ↔ Matrix)
├── 监听 Yjs update → 分片发送 Matrix 自定义事件
├── 接收 Matrix 事件 → 合并到 Yjs 文档
└── 光标/在线状态 → Matrix ephemeral events

Matrix 协议层 (matrix-js-sdk)
├── 文档房间管理
├── 自定义事件: org.muon.doc.sync / org.muon.doc.cursor / org.muon.doc.metadata
├── 评论: Matrix threads
└── 权限: 房间成员 + 权力级别
```

## Yjs 文档结构

```
Y.Doc {
  title: Y.Text("")
  content: Y.XmlFragment()     // Tiptap ProseMirror JSON
  comments: Y.Array<{id, userId, text, selection, resolved, createdAt}>
  cursors: Y.Map<{userId, name, color, from, to}>
  metadata: Y.Map<{createdAt, updatedAt, createdBy, folder}>
}
```

## Vue 组件树

```
src/features/docs/
├── components/
│   ├── DocsPage.vue              ← 重构：路由入口
│   ├── DocsSidebar.vue           ← 新建：文档管理侧边栏
│   │   ├── DocsSidebarNav.vue    ← 分区导航
│   │   ├── DocsFolderTree.vue    ← 文件夹树
│   │   └── DocsCreateButton.vue  ← 新建文档按钮
│   ├── editor/
│   │   ├── DocEditor.vue         ← 协作编辑器主组件
│   │   ├── DocEditorToolbar.vue  ← 工具栏
│   │   ├── DocEditorContent.vue  ← Tiptap 编辑区域
│   │   ├── DocTitleInput.vue     ← 标题编辑
│   │   └── CursorOverlay.vue     ← 远程光标层
│   ├── collaboration/
│   │   ├── CollaboratorAvatars.vue ← 在线协作者
│   │   ├── CommentsPanel.vue     ← 评论面板
│   │   └── ShareDialog.vue       ← 分享/邀请
│   └── DocPreviewCard.vue        ← 文档卡片
├── composables/
│   ├── useDocSync.ts             ← Yjs + Matrix 同步
│   ├── useDocEditor.ts           ← Tiptap + Yjs 绑定
│   ├── useDocCursor.ts           ← 光标同步
│   └── useDocComments.ts         ← 评论管理
├── stores/
│   └── docsStore.ts              ← Pinia：文档列表、文件夹、搜索
├── services/
│   └── matrixSyncProvider.ts     ← Matrix ↔ Yjs Provider
└── types/
    └── doc.ts                    ← 类型定义
```

## 路由设计

```
/docs                    → DocsPage（列表 + 空状态）
/docs/:docId             → DocsPage（列表 + 编辑器）
/docs/folder/:folderId   → DocsPage（按文件夹筛选）
```

## Matrix 事件类型

| 事件类型 | 用途 | 存储方式 |
|---------|------|---------|
| org.muon.doc.sync | Yjs 增量更新（二进制） | 房间消息事件 |
| org.muon.doc.cursor | 光标位置同步 | 房间 ephemeral 事件 |
| org.muon.doc.metadata | 文档标题、文件夹等元数据 | 房间状态事件 |
| m.room.message + thread | 文档评论 | 标准消息 + thread |

## 编辑同步流程

1. 用户输入 → Tiptap (ProseMirror) 产生 transaction
2. y-prosemirror 将 transaction 转换为 Yjs 增量更新
3. Y.Doc 发出 update 事件 (Uint8Array)
4. MatrixSyncProvider 监听 → 分片（< 64KB/片）→ 发送 org.muon.doc.sync
5. Matrix 房间广播给所有成员
6. 其他用户的 MatrixSyncProvider 接收 → 合并分片 → Y.applyUpdate()
7. Yjs 自动合并（CRDT 无冲突）→ y-prosemirror 同步到 ProseMirror state
8. Tiptap 编辑器实时更新

## 离线与重连

- Matrix 断连 → Yjs 继续累积本地编辑
- 重连后 Provider 自动重连房间
- 批量发送离线期间的 Yjs 增量
- CRDT 保证离线编辑合并正确

## 冲突处理

| 场景 | 处理 |
|------|------|
| 两人同时编辑同一段落 | Yjs CRDT 字符级自动合并 |
| 删除他人正在编辑的段落 | 删除者优先，被删段落变幽灵选区 |
| 网络分区长期隔离 | 重连后 CRDT 合并，保留所有编辑 |
| 文档房间被删除/无权限 | 编辑器变为只读，显示错误提示 |
| Yjs 状态损坏 | 回退到最近快照，记录错误日志 |
| sync 事件丢包 | 每条事件带 prevEventId，检测缺失请求重发 |

## 测试策略

| 层 | 测什么 | 工具 |
|----|--------|------|
| composables 单测 | useDocSync、useDocComments | Vitest + msw |
| MatrixSyncProvider 单测 | 序列化、分片合并、重连 | Vitest + 模拟 Matrix client |
| DocEditor 组件测试 | 编辑器渲染、工具栏、光标同步 | Vitest + @vue/test-utils |
| DocsSidebar 组件测试 | 文档 CRUD、搜索、筛选 | Vitest + @vue/test-utils |
| 集成测试 | 创建→编辑→共享完整流程 | Playwright |
