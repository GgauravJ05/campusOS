import { Badge } from '@/components/ui/Surface'
import { ROLE_META } from '@/lib/utils'

export function RoleBadge({ role, short = false }) {
  const meta = ROLE_META[role?.key] || { label: role?.name, short: role?.name, tone: 'zinc' }
  return <Badge tone={meta.tone}>{short ? meta.short : meta.label}</Badge>
}

export function StatusBadge({ user }) {
  if (!user.isActive) return <Badge tone="rose" dot>Deactivated</Badge>
  if (!user.isVerified) return <Badge tone="amber" dot>Unverified</Badge>
  return <Badge tone="emerald" dot>Active</Badge>
}

export function ScopeBadge({ scope }) {
  return scope === 'COLLEGE'
    ? <Badge tone="violet">College-wide</Badge>
    : <Badge tone="zinc">Department</Badge>
}
