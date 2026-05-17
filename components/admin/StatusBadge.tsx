import type { RequestStatus } from '@/types/request'

const STYLES: Record<RequestStatus, { label: string; classes: string }> = {
  pending:  { label: 'Pending',  classes: 'bg-yellow-100 text-yellow-900 ring-yellow-300' },
  approved: { label: 'Approved', classes: 'bg-green-100  text-green-900  ring-green-300'  },
  rejected: { label: 'Rejected', classes: 'bg-red-100    text-red-900    ring-red-300'    },
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  const { label, classes } = STYLES[status]
  return (
    <span
      role="status"
      aria-label={`Request status: ${label}`}
      className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ring-1 ring-inset ${classes}`}
    >
      {label}
    </span>
  )
}
