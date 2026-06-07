import { beforeEach, describe, expect, it } from 'vitest'
import {
  addQuestion,
  addSurvey,
  removeQuestion,
  removeSurvey,
  resetSurveyStore,
  submitResponse,
  surveyStore,
} from '@/features/survey/stores/surveyStore'
import { averageRating, SURVEY_STORAGE_KEY, tallyChoice, textAnswers } from '@/features/survey/types/survey'

function onlySurvey() {
  return surveyStore.state.surveys[0]
}

describe('surveyStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSurveyStore()
  })

  it('starts empty without any seeded mock surveys', () => {
    expect(surveyStore.state.surveys).toEqual([])
  })

  it('creates a survey and persists it', () => {
    addSurvey('满意度调查', '帮助我们改进')

    resetSurveyStore()
    expect(surveyStore.state.surveys).toHaveLength(1)
    expect(onlySurvey()).toMatchObject({ title: '满意度调查', description: '帮助我们改进' })
  })

  it('rejects a survey with an empty title', () => {
    expect(() => addSurvey('   ')).toThrow()
    expect(surveyStore.state.surveys).toEqual([])
  })

  it('seeds default options for choice questions and none for text/rating', () => {
    const survey = addSurvey('问卷')
    const single = addQuestion(survey.id, { type: 'single', title: '你最常用的功能' })!
    const text = addQuestion(survey.id, { type: 'text', title: '建议' })!

    expect(single.options.length).toBeGreaterThan(0)
    expect(text.options).toEqual([])
  })

  it('rejects a response missing a required answer', () => {
    const survey = addSurvey('问卷')
    addQuestion(survey.id, { type: 'single', title: '必答', options: ['A', 'B'], required: true })

    expect(() => submitResponse(survey.id, {})).toThrow('Missing required answer')
    expect(onlySurvey().responses).toEqual([])
  })

  it('accepts a valid response and keeps only known-question answers', () => {
    const survey = addSurvey('问卷')
    const q = addQuestion(survey.id, { type: 'single', title: '选择', options: ['A', 'B'], required: true })!

    submitResponse(survey.id, { [q.id]: 'A', 'stray-question': 'ignored' })

    resetSurveyStore()
    expect(onlySurvey().responses).toHaveLength(1)
    expect(onlySurvey().responses[0].answers).toEqual({ [q.id]: 'A' })
  })

  it('tallies single and multiple choice answers', () => {
    const survey = addSurvey('问卷')
    const q = addQuestion(survey.id, { type: 'multiple', title: '多选', options: ['A', 'B', 'C'] })!

    submitResponse(survey.id, { [q.id]: ['A', 'B'] })
    submitResponse(survey.id, { [q.id]: ['A'] })

    const tally = tallyChoice(onlySurvey(), q.id)
    expect(tally).toEqual({ A: 2, B: 1, C: 0 })
  })

  it('averages rating answers to one decimal', () => {
    const survey = addSurvey('问卷')
    const q = addQuestion(survey.id, { type: 'rating', title: '评分' })!

    submitResponse(survey.id, { [q.id]: 5 })
    submitResponse(survey.id, { [q.id]: 4 })
    submitResponse(survey.id, { [q.id]: 4 })

    expect(averageRating(onlySurvey(), q.id)).toEqual({ average: 4.3, count: 3 })
  })

  it('collects non-empty text answers', () => {
    const survey = addSurvey('问卷')
    const q = addQuestion(survey.id, { type: 'text', title: '建议' })!

    submitResponse(survey.id, { [q.id]: '更快一些' })
    submitResponse(survey.id, {})

    expect(textAnswers(onlySurvey(), q.id)).toEqual(['更快一些'])
  })

  it('removes a question and a survey, persisting both', () => {
    const survey = addSurvey('问卷')
    const q = addQuestion(survey.id, { type: 'text', title: '题' })!
    removeQuestion(survey.id, q.id)
    expect(onlySurvey().questions).toEqual([])

    removeSurvey(survey.id)
    resetSurveyStore()
    expect(surveyStore.state.surveys).toEqual([])
  })

  it('drops invalid persisted surveys when hydrating', () => {
    localStorage.setItem(
      SURVEY_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        surveys: [
          { id: 'good', title: 'Valid', questions: [], responses: [], createdAt: 1 },
          {
            id: 'bad',
            title: 'Broken',
            questions: [{ id: 'q', type: 'unknown', title: 'x', options: [], required: false }],
            responses: [],
            createdAt: 2,
          },
        ],
      }),
    )

    resetSurveyStore()
    expect(surveyStore.state.surveys).toHaveLength(1)
    expect(surveyStore.state.surveys[0].id).toBe('good')
  })
})
