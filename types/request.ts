import { z } from 'zod'

export const REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const

export const requestStatusSchema = z.enum(REQUEST_STATUSES)
export type RequestStatus = z.infer<typeof requestStatusSchema>

export const updateRequestStatusInputSchema = z.object({
  status: z.enum(['approved', 'rejected']),
})
export type UpdateRequestStatusInput = z.infer<typeof updateRequestStatusInputSchema>

export type UpdateRequestStatusResponse = {
  id: string
  status: RequestStatus
  updated_at: string
  changed: boolean
}

export type UpdateRequestStatusError =
  | { error: 'validation_error'; issues: z.core.$ZodIssue[] }
  | { error: 'not_found' }
  | { error: 'illegal_transition'; from: RequestStatus; to: RequestStatus }
  | { error: 'locked' }
  | { error: 'internal_error' }
