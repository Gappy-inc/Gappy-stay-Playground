# T-8 リクエスト承認ワークフロー — 設計書

**Status**: Draft / awaiting review
**Author**: Founding Engineer (Claude)
**Date**: 2026-05-17
**Branch**: `feature/request-approval-workflow`

---

## 0. 仕様書と現実のギャップ — 採用した適応方針

仕様書は Prisma + SQL + React Query + Storybook + `pnpm test` 等を前提に書かれていたが、
リポジトリの実態は以下:

| Spec 前提 | 現実 | 採用方針 |
|---|---|---|
| Prisma + SQL | Upstash Redis + 静的 JSON シード (`lib/runtime-store.ts`) | Redis に乗せる (既存準拠) |
| `requests` テーブル | 存在しない。最近接の概念は **Order** (ゲストが checkout で作る注文) | **Order を承認対象** に再定義 |
| `SELECT FOR UPDATE` | Upstash Redis REST は WATCH/MULTI 非対応 | **アプリレイヤ CAS ロック** (`SET NX EX`) + 楽観的バージョン照合 |
| Zod / Vitest | 未導入 | 新規追加 (理由は §7) |
| React Query / SWR | 未導入 (素の `fetch` + `useState`) | **自前楽観的 reducer** (既存準拠) |
| Storybook | 未導入 | スキップ |
| `pnpm typecheck/lint/test` | scripts に無し | `package.json` に追加 |
| T-7 (RequestsTable) | 未実装 | demo 用に最小実装 (ユーザー承認済) |

判断はユーザーと事前同意済 (Context Q&A 参照)。

---

## 1. 状態機械

```
       approve            (再 approve は no-op, 200)
pending ───────► approved ───────► approved
   │
   │ reject              (再 reject は no-op, 200)
   └───────► rejected ───────► rejected

不正遷移 (HTTP 409 Conflict):
- approved → pending     ※ approved → rejected も不可 (一度確定したら戻せない)
- rejected → pending     ※ rejected → approved も不可
- approved → rejected
- rejected → approved
```

### 規約
- **冪等性**: `current === target` は **常に 200 OK + no-op** (DB 書き込み無し)
- **不正遷移**: 終端状態 (approved/rejected) からの遷移はすべて 409
- **将来拡張**: 「rejected → pending (差し戻し)」が必要になった時点で機械を更新。今は YAGNI で実装しない

### 実装
- `lib/request-status-machine.ts` に純関数として切り出す
  ```ts
  type Transition =
    | { ok: true; nextStatus: RequestStatus; changed: boolean }
    | { ok: false; code: 'illegal_transition'; from: RequestStatus; to: RequestStatus };

  export function transition(from: RequestStatus, to: RequestStatus): Transition;
  ```
- API ルートはこの関数の結果に従ってレスポンスを構築 (機械の知識を route に染み出させない)

---

## 2. データスキーマ変更 (additive のみ)

### 2.1 `Order` 型の拡張 (types/index.ts)

```ts
export type RequestStatus = 'pending' | 'approved' | 'rejected'

export type Order = {
  order_id: string
  booking_id: string
  guest_name: string
  room_type: string
  check_in: string
  items: CartItem[]
  total: number
  created_at: string
  // 追加 (T-8)
  status: RequestStatus              // 既存行は backfill で 'pending'
  updated_at: string                 // ISO8601, 既存行は created_at をコピー
  updated_by: string | null          // admin user ID, 認証未実装の今は null
}
```

**互換性**: 既存の checkout フローは Order を作成して POST する。追加3フィールドのデフォルト値は **API 受信側で補完** (`status='pending'`, `updated_at=created_at`, `updated_by=null`) するため、クライアント側の変更なし。

### 2.2 Redis キー (新規 0、既存スキーマ変更のみ)

| キー | 型 | 用途 |
|---|---|---|
| `hotel:default:orders` | `Order[]` | 既存。`status` 等を含むよう更新 |
| `hotel:default:order-lock:{order_id}` | string | **新規**。CAS ロック。TTL 5 秒 |

ロック衝突時の動作: クライアントには 503 ではなく **409 Conflict (locked)** を返す
(クライアントは「他の管理者が同時操作中」として人間が再試行)。

### 2.3 マイグレーション (`lib/migrations/0001-order-status-backfill.ts`)

CLI フラグ `--dry-run` / `--rollback` を持つ単一スクリプト。標準出力に JSON サマリ。

```
parse argv → mode = 'apply' | 'dry-run' | 'rollback'

forward (apply / dry-run):
  orders = await redis.get('hotel:default:orders') ?? []
  needsBackfill = orders.filter(o =>
    o.status === undefined || o.updated_at === undefined || o.updated_by === undefined
  )
  migrated = orders.map(o => ({
    ...o,
    status: o.status ?? 'pending',
    updated_at: o.updated_at ?? o.created_at,
    updated_by: o.updated_by ?? null,
  }))
  print({ mode, total: orders.length, affected: needsBackfill.length })
  if (mode === 'apply' && needsBackfill.length > 0) {
    await redis.set('hotel:default:orders', migrated)
  }
  // 全行マイグレ済みなら affected=0 で何もしない → 再実行 no-op

rollback:
  orders = await redis.get('hotel:default:orders') ?? []
  hasFields = orders.filter(o => 'status' in o)
  reverted = orders.map(({ status, updated_at, updated_by, ...rest }) => rest)
  print({ mode: 'rollback', total: orders.length, affected: hasFields.length })
  await redis.set('hotel:default:orders', reverted)
```

- **冪等性**: 全行マイグレ済みなら `affected=0` で Redis 書き込みをスキップ → 再実行 no-op
- **`--dry-run`**: 影響行数のみ JSON 出力、Redis 書き込み無し
- **テスト**: `lib/migrations/0001-order-status-backfill.test.ts` で apply / dry-run / apply 再実行 (no-op) / rollback の 4 ケース
- **API 側にも防御的 backfill** を入れる (Redis に未マイグレ行があっても fail しない)
- package.json scripts:
  - `"migrate:0001": "tsx lib/migrations/0001-order-status-backfill.ts"`
  - `"migrate:0001:dry": "tsx lib/migrations/0001-order-status-backfill.ts --dry-run"`
  - `"migrate:0001:rollback": "tsx lib/migrations/0001-order-status-backfill.ts --rollback"`

---

## 3. API 契約

### 3.1 ルート: `app/api/admin/requests/[id]/status/route.ts`

> Spec は `/api/admin/requests/[id]/status` を要求しているため、URL はそのまま採用。
> ハンドラ内部で「`requests` は Order として実装している」ことを 1 行コメントで明記する。

### 3.2 メソッド: `PATCH`

**Request**:
```json
{ "status": "approved" }   // "approved" | "rejected"
```

**Response 200 OK** (遷移成功 or 冪等 no-op):
```json
{
  "id": "ORD-...",
  "status": "approved",
  "updated_at": "2026-05-17T03:21:00.000Z",
  "changed": true
}
```

| Status | 条件 | Body |
|---|---|---|
| 200 | 正規遷移 / 冪等 no-op | `{id, status, updated_at, changed}` |
| 400 | Zod 検証失敗 / 不正な status 値 | `{error: 'validation_error', issues: [...]}` |
| 404 | order 不在 | `{error: 'not_found'}` |
| 409 | 不正な状態遷移 | `{error: 'illegal_transition', from, to}` |
| 409 | ロック競合 (他リクエストが処理中) | `{error: 'locked'}` |
| 500 | 内部エラー | `{error: 'internal_error'}` |

`changed: false` で冪等 no-op を識別可能にする (フロントは toast 文言を分岐できる)。

### 3.3 ハンドラ内処理シーケンス

```
1. Zod parse(body) → 失敗なら 400
2. await params で id 取得 (Next.js 16: params is Promise)
3. lockKey = `hotel:default:order-lock:${id}`
   acquired = await redis.set(lockKey, ts, { nx: true, ex: 5 })
   if (!acquired) return 409 locked
4. try {
     orders = await getRuntimeOrders()
     target = orders.find(o => o.order_id === id)
     if (!target) return 404
     target = backfill(target)              // 未マイグレ防御
     result = transition(target.status, body.status)
     if (!result.ok) return 409 illegal_transition
     if (!result.changed) return 200 { changed:false }   // no-op
     updated = {
       ...target, status: result.nextStatus,
       updated_at: now, updated_by: null,
     }
     await setRuntimeOrders(replace(orders, updated))
     log({ request_id, from, to, latency_ms })
     return 200 { changed:true }
   } finally {
     await redis.del(lockKey)
   }
```

### 3.4 ログ (構造化)

`console.log(JSON.stringify({ event: 'request.status.updated', ... }))` の単一行形式
(既存コードに logger 未導入のため `console.log` で統一)。

**規約**:
- `event` は **ドット区切り** (例: `request.status.updated`, `request.status.rejected.illegal`, `request.status.locked`)
- `latency_ms` は **ハンドラ冒頭で `const t0 = Date.now()`**、レスポンス直前に `Date.now() - t0` で計測
- エラー時は **`error.code` と `error.message` を分離** (例: `error: { code: 'illegal_transition', message: 'cannot transition approved → pending' }`)

**フィールド**:
| キー | 型 | 必須 | 説明 |
|---|---|---|---|
| `event` | string | ✓ | ドット区切り識別子 |
| `request_id` | string | ✓ | Order.order_id |
| `from_status` | RequestStatus \| null | ✓ | 不在なら null |
| `to_status` | RequestStatus | ✓ | 要求された遷移先 |
| `changed` | boolean | ✓ | 実際に書き込みが起きたか |
| `latency_ms` | number | ✓ | Date.now() 差分 |
| `error` | `{ code: string, message: string }` | エラー時のみ | code/message 分離 |

---

## 4. 楽観的更新戦略 (フロント)

**ライブラリ**: 自前 reducer (既存 dashboard は素の `fetch + useState`、React Query/SWR は未導入)

### 4.1 フロー (`StatusActions.tsx`)

```
1. Approve/Reject クリック
2. 即座に親に optimistic next status を伝える (onChange callback)
   親はテーブル行を即書き換え
3. PATCH を投げる
4a. 200 changed:true  → toast 成功
4b. 200 changed:false → toast 「既に承認/却下済み」 (冪等を可視化)
4c. 409 illegal_transition → 親に rollback 指示 + toast「他の管理者により変更されました」
4d. 409 locked → 親に rollback + toast「**他のスタッフが同時に操作中です。少し待ってからもう一度お試しください**」
4e. 4xx/5xx → 親に rollback + toast「エラー」
5. ボタンは送信中 disabled + aria-busy="true"
```

### 4.2 トースト

既存に toast ライブラリ無し。**最小実装**: `RequestsTable` 内に `notice` state を持ち、3 秒で自動消滅する `<div role="status">` を fixed bottom-right に描画。
独自 design system 化はしない (YAGNI)。

### 4.3 Reject 確認

`window.confirm` は既存コードでも未使用 (confirm/AlertDialog ライブラリも未導入)。
**最小実装**: `StatusActions` 内で 2 段階クリック (`pendingReject` state)。

- 1 回目クリック: ボタンテキストが「Confirm Reject」に変化
- **背景色が通常の Reject ボタン色 → 濃い赤** (例: `bg-red-600` → `bg-red-800`) に切り替わり、視覚的に警告を強める。`ring-2 ring-red-300` も付与して触知性を上げる
- 2 回目クリック: PATCH 送信
- 3 秒経過で自動キャンセル (`pendingReject` を false に戻す)
- aria 周り: 1 回目クリック後は `aria-live="polite"` でテキスト変更を読み上げ

これで UI 1 つで完結し、新規モーダル基盤を作らない。
**将来 AlertDialog 基盤が導入されたら差し替える** (§8 参照)。

---

## 5. テスト戦略

### 5.1 ユニット (`lib/request-status-machine.test.ts`)
- 全 9 ケース (3×3 マトリクス) を列挙して `transition()` の戻り値を検証
- legal 6 件 (3 同一 = no-op、pending→approved、pending→rejected、approved→approved、rejected→rejected)
  + illegal 6 件 (approved→pending, approved→rejected, rejected→pending, rejected→approved, etc.)

### 5.2 コンポーネント (`components/admin/StatusBadge.test.tsx`)
- 3 状態それぞれで `getByRole('status', { name: /pending|approved|rejected/ })` が見つかること
- 適切な Tailwind クラスが付与されていること

### 5.3 API 統合 (`app/api/admin/requests/[id]/status/route.test.ts`)
- `@upstash/redis` を vitest `vi.mock` でメモリストアに差し替え
- 200 (pending→approved), 200 (pending→rejected)
- 200 冪等 (approved→approved, `changed:false`)
- 400 Zod 不正 (`status: "foo"`)
- 404 不在 ID
- 409 不正遷移 (approved→pending)
- race: ロック取得済みの状態で 2 本目が 409 locked を返すこと

### 5.4 受け入れ基準対応 (最終報告で完成形)
spec 内に列挙された acceptance criteria 各項目 → ファイル + テスト名で紐付け

---

## 6. ファイル一覧 (予定)

```
新規:
  docs/designs/T-8-approval-workflow.md          ← 本書
  types/request.ts                               ← Zod + 型
  lib/request-status-machine.ts                  ← 状態遷移純関数
  lib/request-status-machine.test.ts
  lib/migrations/0001-order-status-backfill.ts
  app/api/admin/requests/[id]/status/route.ts
  app/api/admin/requests/[id]/status/route.test.ts
  app/api/admin/requests/route.ts                ← GET all (RequestsTable 用)
  components/admin/StatusBadge.tsx
  components/admin/StatusBadge.test.tsx
  components/admin/StatusActions.tsx
  components/admin/RequestsTable.tsx
  vitest.config.ts
  test/setup.ts                                  ← Redis mock

変更:
  types/index.ts                                 ← Order 拡張
  app/api/admin/orders/route.ts                  ← POST 時に status/updated_at backfill
  app/admin/dashboard/page.tsx                   ← RequestsTable セクション追加
  package.json                                   ← deps + scripts
  tsconfig.json                                  ← test 除外を追加 (build に影響させない)
```

---

## 7. 新規依存追加の正当化

仕様の「新規依存追加 0 件」と「Zod 検証 + テスト必須」が矛盾するため、最小限を追加:

| パッケージ | 理由 | 代替検討 |
|---|---|---|
| `zod` (prod) | 仕様が runtime 検証を明示要求。手書き type guard は同等品質を確保するコストが高く、保守性で劣る | 手書き → 却下 |
| `vitest` (dev) | 仕様がテスト必須。Next.js 16 + ESM + TS で最も摩擦少ない | `node --test` → JSX/import.meta 周りで不便 |
| `@testing-library/react` (dev) | StatusBadge のレンダリングテスト用 | `react-dom/test-utils` → deprecated |
| `@testing-library/jest-dom` (dev) | `toBeInTheDocument` matcher | 自前 → ノイズ |
| `jsdom` (dev) | vitest コンポーネントテスト用 DOM | happy-dom → どちらでも可、jsdom が枯れている |

**追加せず**: React Query / SWR / Storybook / Prisma / sqlite → 既存パターン尊重

---

## 8. 既知の制約・技術的負債

- **CAS ロックは best-effort**: Upstash REST は真の atomic CAS をサポートしない。`SET NX EX` + アプリレイヤ check の組み合わせで、極めて稀な race window が残る。許容範囲とし、認証実装後に SQL に移行する際解消。
- **`updated_by` は常に null**: 認証未実装。実装時 NOT NULL 化が望ましい。
- **マイグレーション実行は手動**: CI 統合は本タスクスコープ外。
- **構造化ログは `console.log`**: 既存に logger 未導入。本格 logger は別タスクで。
- **Reject 確認は 2 段階クリック**: AlertDialog 基盤が未導入のための暫定実装。**将来 AlertDialog 基盤 (e.g. Radix UI Dialog, shadcn/ui AlertDialog 等) が導入されたら `StatusActions` 内のロジックを差し替える** (state 持ち回りを撤廃し、宣言的なモーダル呼び出しに置換)。差し替え時のテストは StatusActions.test.tsx の確認フロー部分のみ書き換えで済むよう、テストは「クリック → 確認 → 実行」の振る舞いベースで書く。

---

## 9. レビュー観点

1. **対象を Order に再定義** したことに同意するか?
2. **ロック衝突を 409 で返す** 方針 (vs 503 / リトライ) に同意するか?
3. **Reject 確認の「2 段階クリック」** UI に同意するか? (モーダル基盤新規作成は YAGNI と判断)
4. **マイグレーション手動実行** で良いか? (CI 自動化はスコープ外)
5. **依存追加 5 件** (zod, vitest, @testing-library/react, @testing-library/jest-dom, jsdom) を承認するか?

---

**実装着手は本書のレビュー承認後。**
