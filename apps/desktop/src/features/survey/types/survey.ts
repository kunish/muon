export const SURVEY_STORAGE_KEY = 'muon.surveys.v1'

/** 题型：单选 / 多选 / 填空 / 评分(1-5) */
export type QuestionType = 'single' | 'multiple' | 'text' | 'rating'

/** 答案取值：单选/填空=string，多选=string[]，评分=number。 */
export type AnswerValue = string | string[] | number

export interface Question {
  id: string
  type: QuestionType
  title: string
  /** 单选/多选的候选项；填空/评分忽略。 */
  options: string[]
  required: boolean
}

export interface SurveyResponse {
  id: string
  /** 按 questionId 索引的答案。 */
  answers: Record<string, AnswerValue>
  submittedAt: number
}

export interface Survey {
  id: string
  title: string
  description?: string
  questions: Question[]
  responses: SurveyResponse[]
  createdAt: number
}

export const QUESTION_TYPES: readonly QuestionType[] = ['single', 'multiple', 'text', 'rating']
export const RATING_MAX = 5

export function isChoiceType(type: QuestionType): boolean {
  return type === 'single' || type === 'multiple'
}

export function isValidQuestionType(value: unknown): value is QuestionType {
  return typeof value === 'string' && QUESTION_TYPES.includes(value as QuestionType)
}

function isAnswerValue(value: unknown): value is AnswerValue {
  if (typeof value === 'string' || typeof value === 'number') return true
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isValidQuestion(value: unknown): value is Question {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Question>
  return (
    typeof candidate.id === 'string' &&
    !!candidate.id &&
    isValidQuestionType(candidate.type) &&
    typeof candidate.title === 'string' &&
    Array.isArray(candidate.options) &&
    candidate.options.every((opt) => typeof opt === 'string') &&
    typeof candidate.required === 'boolean'
  )
}

function isValidResponse(value: unknown): value is SurveyResponse {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SurveyResponse>
  if (typeof candidate.id !== 'string' || !candidate.id) return false
  if (typeof candidate.submittedAt !== 'number') return false
  if (!candidate.answers || typeof candidate.answers !== 'object') return false
  return Object.values(candidate.answers).every(isAnswerValue)
}

export function isValidSurvey(value: unknown): value is Survey {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Survey>
  return (
    typeof candidate.id === 'string' &&
    !!candidate.id &&
    typeof candidate.title === 'string' &&
    (candidate.description === undefined || typeof candidate.description === 'string') &&
    Array.isArray(candidate.questions) &&
    candidate.questions.every(isValidQuestion) &&
    Array.isArray(candidate.responses) &&
    candidate.responses.every(isValidResponse) &&
    typeof candidate.createdAt === 'number'
  )
}

/** 某道题的某个答案是否“已作答”（用于必填校验）。 */
export function isAnswered(value: AnswerValue | undefined): boolean {
  if (value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return value > 0
  return value.length > 0
}

/** 单选/多选题各选项的计票。 */
export function tallyChoice(survey: Survey, questionId: string): Record<string, number> {
  const tally: Record<string, number> = {}
  const question = survey.questions.find((item) => item.id === questionId)
  if (!question) return tally
  for (const option of question.options) tally[option] = 0

  for (const response of survey.responses) {
    const answer = response.answers[questionId]
    if (answer === undefined) continue
    const picks = Array.isArray(answer) ? answer : [answer]
    for (const pick of picks) {
      if (typeof pick === 'string' && pick in tally) tally[pick] += 1
    }
  }
  return tally
}

/** 评分题的平均分与作答数（保留一位小数）。 */
export function averageRating(survey: Survey, questionId: string): { average: number; count: number } {
  const ratings: number[] = []
  for (const response of survey.responses) {
    const answer = response.answers[questionId]
    if (typeof answer === 'number' && answer > 0) ratings.push(answer)
  }
  if (ratings.length === 0) return { average: 0, count: 0 }
  const sum = ratings.reduce((total, value) => total + value, 0)
  return { average: Math.round((sum / ratings.length) * 10) / 10, count: ratings.length }
}

/** 填空题的全部文本答案。 */
export function textAnswers(survey: Survey, questionId: string): string[] {
  const answers: string[] = []
  for (const response of survey.responses) {
    const answer = response.answers[questionId]
    if (typeof answer === 'string' && answer.trim()) answers.push(answer.trim())
  }
  return answers
}

export function generateSurveyId(now: number): string {
  return `survey:${now}:${Math.random().toString(36).slice(2, 10)}`
}

export function generateQuestionId(now: number): string {
  return `q:${now}:${Math.random().toString(36).slice(2, 10)}`
}

export function generateResponseId(now: number): string {
  return `resp:${now}:${Math.random().toString(36).slice(2, 10)}`
}
