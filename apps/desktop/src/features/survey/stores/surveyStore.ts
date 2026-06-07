import type { AnswerValue, Question, QuestionType, Survey, SurveyResponse } from '../types/survey'
import { Store } from '@tanstack/vue-store'
import {
  generateQuestionId,
  generateResponseId,
  generateSurveyId,
  isAnswered,
  isChoiceType,
  isValidSurvey,
  SURVEY_STORAGE_KEY,
} from '../types/survey'

interface PersistedSurveyState {
  version: 1
  surveys: Survey[]
}

interface LoadedSurveyState {
  surveys: Survey[]
  normalized: boolean
}

interface AddQuestionInput {
  type: QuestionType
  title: string
  options?: string[]
  required?: boolean
  now?: number
}

function normalizePersistedSurveys(surveys: unknown[]): LoadedSurveyState {
  const deduped = new Map<string, Survey>()
  let normalized = false

  for (const survey of surveys) {
    if (!isValidSurvey(survey)) {
      normalized = true
      continue
    }
    if (deduped.has(survey.id)) normalized = true
    deduped.set(survey.id, survey)
  }

  return { surveys: [...deduped.values()], normalized }
}

function loadState(): LoadedSurveyState {
  try {
    const raw = localStorage.getItem(SURVEY_STORAGE_KEY)
    if (!raw) return { surveys: [], normalized: false }

    const parsed = JSON.parse(raw) as Partial<PersistedSurveyState>
    if (parsed.version !== 1 || !Array.isArray(parsed.surveys)) return { surveys: [], normalized: false }

    return normalizePersistedSurveys(parsed.surveys)
  } catch {
    return { surveys: [], normalized: false }
  }
}

function persistSurveys(surveys: Survey[]): void {
  const payload: PersistedSurveyState = { version: 1, surveys }
  try {
    localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.warn('[surveyStore] Failed to persist surveys:', err)
  }
}

export interface SurveyState {
  surveys: Survey[]
  hydrated: boolean
}

function createInitialState(): SurveyState {
  const { surveys, normalized } = loadState()
  if (normalized) persistSurveys(surveys)
  return { surveys, hydrated: true }
}

export const surveyStore = new Store<SurveyState>(createInitialState())

export function selectSurveys(state: SurveyState): Survey[] {
  return state.surveys
}

export function hydrate(): void {
  const { surveys, normalized } = loadState()
  surveyStore.setState((s) => ({ ...s, surveys, hydrated: true }))
  if (normalized) persistSurveys(surveys)
}

function commit(surveys: Survey[]): void {
  surveyStore.setState((s) => ({ ...s, surveys }))
  persistSurveys(surveyStore.state.surveys)
}

function mapSurvey(surveyId: string, fn: (survey: Survey) => Survey): void {
  commit(surveyStore.state.surveys.map((survey) => (survey.id === surveyId ? fn(survey) : survey)))
}

export function addSurvey(title: string, description = '', now = Date.now()): Survey {
  const trimmed = title.trim()
  if (!trimmed) throw new Error('Survey title is required')

  const survey: Survey = {
    id: generateSurveyId(now),
    title: trimmed,
    description: description.trim() || undefined,
    questions: [],
    responses: [],
    createdAt: now,
  }
  commit([survey, ...surveyStore.state.surveys])
  return survey
}

export function updateSurvey(surveyId: string, patch: Partial<Pick<Survey, 'title' | 'description'>>): void {
  mapSurvey(surveyId, (survey) => ({
    ...survey,
    ...(patch.title !== undefined ? { title: patch.title.trim() || survey.title } : {}),
    ...(patch.description !== undefined ? { description: patch.description.trim() || undefined } : {}),
  }))
}

export function removeSurvey(surveyId: string): void {
  const next = surveyStore.state.surveys.filter((survey) => survey.id !== surveyId)
  if (next.length === surveyStore.state.surveys.length) return
  commit(next)
}

export function addQuestion(surveyId: string, input: AddQuestionInput): Question | undefined {
  const title = input.title.trim()
  if (!title) return undefined
  const now = input.now ?? Date.now()
  const question: Question = {
    id: generateQuestionId(now),
    type: input.type,
    title,
    options: isChoiceType(input.type)
      ? (input.options ?? ['选项 1', '选项 2']).map((opt) => opt.trim()).filter(Boolean)
      : [],
    required: input.required ?? false,
  }
  mapSurvey(surveyId, (survey) => ({ ...survey, questions: [...survey.questions, question] }))
  return question
}

export function updateQuestion(
  surveyId: string,
  questionId: string,
  patch: Partial<Pick<Question, 'title' | 'options' | 'required'>>,
): void {
  mapSurvey(surveyId, (survey) => ({
    ...survey,
    questions: survey.questions.map((question) =>
      question.id === questionId
        ? {
            ...question,
            ...(patch.title !== undefined ? { title: patch.title.trim() || question.title } : {}),
            ...(patch.options !== undefined && isChoiceType(question.type)
              ? { options: patch.options.map((opt) => opt.trim()).filter(Boolean) }
              : {}),
            ...(patch.required !== undefined ? { required: patch.required } : {}),
          }
        : question,
    ),
  }))
}

export function removeQuestion(surveyId: string, questionId: string): void {
  mapSurvey(surveyId, (survey) => ({
    ...survey,
    questions: survey.questions.filter((question) => question.id !== questionId),
  }))
}

/** 提交一份答卷；缺失必填项时抛错。只保留属于该问卷题目的答案。 */
export function submitResponse(
  surveyId: string,
  answers: Record<string, AnswerValue>,
  now = Date.now(),
): SurveyResponse {
  const survey = surveyStore.state.surveys.find((item) => item.id === surveyId)
  if (!survey) throw new Error('Unknown survey')

  const cleaned: Record<string, AnswerValue> = {}
  for (const question of survey.questions) {
    const answer = answers[question.id]
    if (question.required && !isAnswered(answer)) throw new Error('Missing required answer')
    if (answer !== undefined && isAnswered(answer)) cleaned[question.id] = answer
  }

  const response: SurveyResponse = { id: generateResponseId(now), answers: cleaned, submittedAt: now }
  mapSurvey(surveyId, (item) => ({ ...item, responses: [...item.responses, response] }))
  return response
}

export function resetSurveyStore(): void {
  surveyStore.setState(() => createInitialState())
}
