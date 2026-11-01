import { useCallback } from 'react'
import { getMyPlan, type PlanDto } from '../api/plans'
import { ApiError } from '../api/client'
import { useResource } from './useResource'

const isEmpty = (plan: PlanDto | null) => !plan || plan.meals.length === 0
export function usePlan(token: string | null, user: string | null, date?: string) {
  const load = useCallback(async (signal: AbortSignal) => {
    try { return await getMyPlan(token!, signal, date) } catch (error) {
      if ((error instanceof ApiError && error.status === 404) || (error instanceof Error && error.message === 'sin-plan')) return null
      throw error
    }
  }, [token, date])
  return useResource(JSON.stringify([user, token, date]), !!token, load, isEmpty)
}
