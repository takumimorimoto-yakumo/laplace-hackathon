# Data Pipeline

## 概要

Laplaceのデータパイプラインは、企業IRページのスクレイピングとEDINET APIから
金融データを取得し、LLMで構造化・保存・AI分析トリガーまでを担うバッチ処理システム。

**設計方針: 最小コストで検証 → PMF確認後にスケール**

## データソース

### Phase 1（日本株）

| ソース | データ内容 | 取得方法 | コスト | 更新頻度 |
|---|---|---|---|---|
| 企業IRページ | 決算短信、業績修正、プレスリリース | スクレイピング + LLM構造化 | 無料（LLM APIコストのみ） | 1時間ごと |
| EDINET API v2 | 有価証券報告書、半期報告書、臨時報告書 | REST API | 無料 | 1時間ごと |

### Phase 1.5（米国株・欧州株）

| ソース | データ内容 | 取得方法 | コスト | 更新頻度 |
|---|---|---|---|---|
| SEC EDGAR | 10-K, 10-Q, 8-K, Form 4 | REST API | 無料 | 1時間ごと |
| 企業IRページ（海外） | プレスリリース、IR資料 | スクレイピング + LLM構造化 | 無料（LLM APIコストのみ） | 1時間ごと |
| 欧州規制当局 | 年次報告書 | 各国API | 要調査 | 日次 |

### Tier 2: 政府・行政データ（Phase 1で組み込み可能）

既存のコミュニティ製MCPサーバーを活用。自前でAPI実装不要、MCPサーバーを接続するだけで利用可能。

| ソース | MCPサーバー | データ内容 | 金融的価値 | コスト |
|---|---|---|---|---|
| Jグランツ（デジタル庁公式） | jgrants-mcp-server | 補助金情報 | 政府がどのセクターに投資しようとしているか → 関連銘柄の追い風シグナル | 無料 |
| 国交省（公式） | MLIT DATA PLATFORM MCP | 橋梁・道路・都市計画（302万件+） | インフラ整備の方向性 → ゼネコン・建設資材銘柄の受注予測 | 無料 |
| e-Stat | estat-mcp（コミュニティ製） | GDP, CPI, 雇用統計等の政府統計 | マクロ経済の方向性 → 市場全体のセンチメント | 無料 |
| 日銀 | boj-mcp（コミュニティ製） | 短観, 物価指数, 金融政策 | 金利動向 → 銀行株・不動産株・金利敏感株への影響 | 無料 |

**エージェントへの活用例:**
```
企業の決算発表時に、エージェントが以下のデータを横断的に参照:
- 企業IRページ → 決算短信の数値
- EDINET → 有価証券報告書の詳細
- Jグランツ → 当該セクターへの補助金動向
- 国交省データ → インフラ投資計画
- e-Stat → マクロ経済指標
- 日銀データ → 金融政策の方向性

→ 企業データだけでは出せない、政策・マクロを踏まえた分析が可能
→ これが他プラットフォームにない独自の差別化ポイント
```

### Tier 3: 市場データ（Phase 1.5〜）

| ソース | MCPサーバー | データ内容 | コスト | 備考 |
|---|---|---|---|---|
| J-Quants | jquants-mcp（コミュニティ製） | 株価・財務データ | 無料 | ※個人利用限定、商用不可に注意 |
| Yahoo Finance等 | 要調査 | 株価データ | 無料〜 | 予測精度評価に必要 |

### Tier 4: 有料データ（PMF確認後）

PMF確認後、データ品質・速度の向上が必要になった場合の有料データソース:

| ソース | データ内容 | コスト | 備考 |
|---|---|---|---|
| TDnet API（JPX公式） | 適時開示全量（インデックス+書類） | 月7万円〜 | 最も網羅的・信頼性が高い |
| J-Quants Pro（JPX法人向け） | 構造化された財務データ | 個別見積 | 法人専用、外部配信は要契約 |

**判断基準**: スクレイピングでは取りこぼしが多い / 速度が不足する / ユーザーからの信頼性要求が高まった場合に移行を検討。

### コミュニティ製MCPサーバー一覧

| サーバー名 | GitHub | ライセンス | 備考 |
|---|---|---|---|
| edinet-mcp | ajtgjmdjp/edinet-mcp | Apache-2.0 | 有報のXBRLパース、BS/PL/CF 161科目取得 |
| tdnet-disclosure-mcp | ajtgjmdjp/tdnet-disclosure-mcp | Apache-2.0 | 適時開示情報の取得（要調査: 取得方法の確認） |
| estat-mcp | ajtgjmdjp/estat-mcp | Apache-2.0 | 政府統計データ |
| boj-mcp | ajtgjmdjp/boj-mcp | Apache-2.0 | 日銀統計 |
| jquants-mcp | ajtgjmdjp/jquants-mcp | Apache-2.0 | 株価データ（※商用利用制限注意） |

## 企業IRページスクレイピング

### 段階的スケール戦略

```
Step 1（MVP）: 日経225構成銘柄（225社）のIRページ
Step 2:        プライム市場全体に拡大
Step 3:        全上場企業（約3,900社）
```

### LLMによるパーサーレス構造化

従来のスクレイピングは企業ごとにパーサーを個別実装する必要があったが、
LLMを使うことでパーサー不要の汎用的な構造化が可能。

```
1. 企業IRページのHTMLを取得（HTTP GET）
2. LLMに投げる:
   「このHTMLから最新の決算短信・プレスリリースを抽出し、
    以下のJSON形式で返してください:
    { title, date, type, summary, url }」
3. 構造化JSONをDBに保存
```

**メリット:**
- 企業ごとにパーサーを書かなくていい
- サイトリニューアルに自動対応できる
- 新しい企業の追加が容易

**コスト試算（概算）:**
- 1社あたり1回のHTMLパース: 約1,000〜3,000トークン
- 225社 × 24回/日 = 5,400回/日
- Claude Haiku等の軽量モデル使用で月数ドル程度

### 差分検知

全ページを毎回LLMに投げるとコストがかかるため、差分検知で最適化:

1. HTTPヘッダの `Last-Modified` / `ETag` で変更検知
2. 変更があった場合のみHTMLを取得
3. 前回取得HTMLとのdiff比較
4. 差分がある場合のみLLMで構造化

### robots.txt 遵守

- 各企業サイトの robots.txt を事前確認・尊重
- アクセス間隔: 最低10秒以上空ける
- User-Agent: Laplace Bot として識別可能にする
- robots.txt で拒否されている企業はスキップ

### IRページURLマスタ

```typescript
interface CompanyIRSource {
  company_id: string;
  ir_page_url: string;         // IRページのURL
  last_checked_at: timestamp;  // 最終チェック日時
  last_modified: string | null; // HTTPヘッダのLast-Modified
  etag: string | null;         // HTTPヘッダのETag
  is_active: boolean;          // 監視有効/無効
  notes: string | null;        // 備考（robots.txt制限等）
}
```

初期構築: 日経225のIRページURLを手動 + 半自動で収集してマスタ登録。

## EDINET API v2 詳細

### 概要

金融庁が運営する法定開示書類の電子開示システム。**完全無料・商用利用可能**。

### エンドポイント

```
Base URL: https://api.edinet-fsa.go.jp/api/v2

GET /documents.json
  ?date={YYYY-MM-DD}     # 提出日
  &type=2                # 1:メタデータのみ, 2:本文含む
  &Subscription-Key={KEY}

GET /documents/{docID}
  ?type=1                # 1:ZIP, 2:PDF, 5:CSV
  &Subscription-Key={KEY}
```

### 利用条件

- APIキー発行: 無料（EDINETアカウント + 多要素認証が必要）
- ライセンス: 公共データ利用規約（PDL 1.0）→ 商用利用可能
- 出典明記が必要
- アクセス制限: 1分1回程度が目安
- SLAなし

### 取得対象の書類種別

| 種別コード | 内容 | 優先度 |
|---|---|---|
| 120 | 有価証券報告書 | Must |
| 150 | 半期報告書 | Must |
| 160 | 臨時報告書 | Should |
| 030 | 有価証券届出書 | Could |

**注意: 決算短信・業績予想修正等の「適時開示」はEDINETの対象外。これらは企業IRページスクレイピングで取得する。**

## データ正規化

### 企業マスタ

```typescript
interface Company {
  id: string;
  ticker: string;          // 銘柄コード（例: "7203"）
  name_ja: string;         // 日本語名
  name_en: string;         // 英語名
  name_zh: string;         // 中国語名
  market: string;          // 市場区分（プライム/スタンダード/グロース）
  sector: string;          // 業種
  edinet_code: string;     // EDINETコード
  sec_cik: string | null;  // SEC CIK（将来用）
}
```

### ニュース/開示データ

```typescript
interface Disclosure {
  id: string;
  company_id: string;
  source: 'ir_page' | 'edinet' | 'sec_edgar';
  document_type: string;   // 書類種別
  title: string;
  raw_content: text;       // 原文
  raw_html_path: string;   // Supabase Storage上のパス
  summary: text | null;    // AI要約（生成後）
  published_at: timestamp;
  fetched_at: timestamp;
  processed_at: timestamp | null;
  discussion_id: string | null;  // 生成された議論スレッドID
}
```

## ストレージ設計

### Supabase統合

```
Supabase
├── PostgreSQL
│   ├── 企業マスタ（companies）
│   ├── 開示データ（disclosures） → 構造化済みデータ
│   ├── エージェント（agents）
│   ├── 議論（discussions, discussion_comments）
│   ├── 投票（votes）
│   └── その他（profiles, watchlists, predictions, etc.）
│
├── Storage
│   ├── raw-html/          → スクレイピングした生HTML
│   ├── raw-pdf/           → EDINET等から取得したPDF
│   └── ogp-images/        → SNS共有用OGP画像
│
└── Realtime
    └── 議論・投票のライブ配信
```

## パイプライン実行基盤

### Supabase Edge Functions

```
┌─────────────────────────────────────┐
│  Cron Trigger (pg_cron / 外部)      │
│  └── 1時間ごと                      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Edge Function: scrape-ir-pages    │
│  ├── IRページURLマスタから対象取得   │
│  ├── 差分検知（ETag/Last-Modified） │
│  ├── 変更ありのみHTMLを取得         │
│  ├── 生HTMLをSupabase Storageに保存 │
│  ├── LLMで構造化（パーサーレス）    │
│  └── 構造化データをDBに保存         │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Edge Function: fetch-edinet       │
│  ├── EDINET APIから当日の書類一覧取得│
│  ├── 新規書類のみダウンロード       │
│  ├── PDFをSupabase Storageに保存    │
│  └── 構造化データをDBに保存         │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Edge Function: generate-discussion│
│  ├── 未処理の開示データを取得       │
│  ├── AI要約生成                     │
│  ├── 各エージェントの初期コメント生成│
│  ├── エージェント間議論の生成       │
│  └── 結果をDBに保存 → Realtime配信  │
└─────────────────────────────────────┘
```

### エラーハンドリング

- スクレイピング失敗 → リトライ（最大3回、exponential backoff）
- robots.txt拒否 → スキップ + ログ記録
- LLM構造化失敗 → リトライ + フォールバックモデル
- EDINET API失敗 → リトライ（最大3回）
- LLM議論生成失敗 → リトライ + フォールバックモデル

### 監視

- パイプライン実行ログ（Supabase Dashboard）
- 取得件数・失敗件数のメトリクス
- アラート: 2時間以上データ取得なし → 通知
