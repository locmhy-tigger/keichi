// ============================================================
// Claude API Utility
// Quiz generation (Sonnet) + Prompt evaluation (Haiku)
// ============================================================
import Anthropic from '@anthropic-ai/sdk'
import type {
  AiQuizMissionContent,
  PromptMissionContent,
  AiQuizGenerationResponse,
  PromptEvaluationResponse,
} from '@/types/mission'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// ─────────────────────────────────────────
// QUIZ GENERATION — claude-sonnet-4-5
// Teacher-triggered, quality over speed
// ─────────────────────────────────────────

const QUIZ_SYSTEM_PROMPT = `你是一位香港中學教師的 AI 助理，專門根據提供的教學材料生成練習題目。

規則：
1. 只以繁體中文出題，適合香港中學生程度
2. 每題必須有 4 個選項（A/B/C/D），只有一個正確答案
3. 解釋需簡潔清晰，50 字以內
4. 嚴格按指定 JSON 格式輸出，不要有任何前言或後記
5. 若輸入材料與教學無關（如個人資料、暴力、色情），輸出 {"error": "CONTENT_UNSAFE"}

輸出格式（JSON only）：
{
  "questions": [
    {
      "id": "q1",
      "question": "問題內容",
      "options": ["選項A", "選項B", "選項C", "選項D"],
      "answer": 0,
      "explanation": "答案解釋",
      "difficulty": "BASIC"
    }
  ]
}`

export async function generateQuiz(
  sourceText: string,
  count: number = 5,
  difficulty: 'BASIC' | 'ADVANCED' | 'CHALLENGE' = 'BASIC'
): Promise<AiQuizGenerationResponse> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    system: QUIZ_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `請根據以下材料，生成 ${count} 條${difficulty === 'BASIC' ? '基礎' : difficulty === 'ADVANCED' ? '進階' : '挑戰'}程度的選擇題：\n\n${sourceText}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  // Strip markdown fences if model accidentally includes them
  const clean = text.replace(/```json\n?|```\n?/g, '').trim()

  const parsed = JSON.parse(clean)

  if (parsed.error === 'CONTENT_UNSAFE') {
    throw new Error('CONTENT_UNSAFE')
  }

  return parsed as AiQuizGenerationResponse
}

// ─────────────────────────────────────────
// PROMPT EVALUATION — claude-haiku-4-5
// Student-triggered, speed is critical
// ─────────────────────────────────────────

function buildEvaluationSystemPrompt(rubric: string): string {
  return `你是一位評估學生 Prompt Engineering 技巧的 AI 評分員。

評分標準（由老師設定）：
${rubric}

評分維度（每項 0-25 分，共 100 分）：
- clarity（清晰度）：指令是否明確無歧義
- completeness（完整性）：是否包含必要的背景和限制條件
- structure（結構性）：是否運用 Role/Task/Format 等結構化技巧
- creativity（創意性）：是否有獨到的引導方式或技巧

規則：
1. 若輸入包含不雅、暴力、個人資料等內容，回傳 {"safe": false, "reason": "原因"}
2. 否則給出評分，feedback 不超過 80 字，使用繁體中文
3. 只輸出 JSON，不要前言後記

輸出格式：
{
  "safe": true,
  "score": 75,
  "breakdown": { "clarity": 20, "completeness": 18, "structure": 22, "creativity": 15 },
  "feedback": "指令結構清晰，但缺乏具體的輸出格式說明。建議加入「請以條列式列出」等格式要求。"
}`
}

export async function evaluatePrompt(
  studentPrompt: string,
  missionContent: PromptMissionContent
): Promise<PromptEvaluationResponse> {
  const message = await client.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 512,
    system: buildEvaluationSystemPrompt(missionContent.rubric),
    messages: [
      {
        role: 'user',
        content: `任務情境：${missionContent.scenario}\n\n學生撰寫的 Prompt：\n${studentPrompt}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const clean = text.replace(/```json\n?|```\n?/g, '').trim()

  return JSON.parse(clean) as PromptEvaluationResponse
}

// ─────────────────────────────────────────
// ICHI QUERY — claude-sonnet-4-5
// Teacher-facing contextual Q&A over school data
// ─────────────────────────────────────────

const ICHI_SYSTEM_PROMPT = `你是「ICHI」，香港中學的 AI 校務助理。
你根據學校公告記錄和學生行為記錄，以繁體中文回答老師的問題。

規則：
1. 只根據提供的記錄作答，不要捏造資料
2. 若記錄中找不到相關資訊，直接說明
3. 回答簡潔清晰，可用條列式
4. 涉及個別學生時，謹慎表述，只引用記錄中已有的事實`

type ICHIAnnouncement = {
  title: string
  body: string
  target: string
  committee: string | null
  priority: string
  createdAt: Date
  author: { name: string | null }
}

type ICHIBehaviorRecord = {
  date: Date
  className: string
  studentName: string
  type: string
  description: string
  action: string | null
  resolved: boolean
}

export async function queryICHI(
  query: string,
  announcements: ICHIAnnouncement[],
  behaviorRecords: ICHIBehaviorRecord[],
): Promise<string> {
  const annLines = announcements.length > 0
    ? announcements.map((a) => {
        const date = new Date(a.createdAt).toLocaleDateString('zh-HK')
        const badge = a.priority !== 'NORMAL' ? `【${a.priority === 'URGENT' ? '緊急' : '重要'}】` : ''
        const scope = a.committee ? ` (${a.committee})` : ` (${a.target})`
        return `[${date}]${badge} ${a.title}${scope}\n${a.body}`
      }).join('\n\n')
    : '（無公告記錄）'

  const bhrLines = behaviorRecords.length > 0
    ? behaviorRecords.map((r) => {
        const date = new Date(r.date).toLocaleDateString('zh-HK')
        const kind = r.type === 'MISCONDUCT' ? '違規' : '嘉許'
        const followUp = r.action ? ` → 跟進：${r.action}` : ''
        const status = r.resolved ? ' ✓已處理' : ''
        return `[${date}] ${r.className} · ${r.studentName} · ${kind}：${r.description}${followUp}${status}`
      }).join('\n')
    : '（無行為記錄）'

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 700,
    system: ICHI_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `公告記錄（最近 30 條）：\n${annLines}\n\n學生行為記錄（最近 30 條）：\n${bhrLines}\n\n問題：${query}`,
      },
    ],
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
}
