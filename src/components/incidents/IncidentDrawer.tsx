/**
 * IncidentDrawer — right slide-over for `/incidents` (incidents.html mockup).
 * Built on Radix Dialog primitives: focus-trapped, ESC closes, overlay click closes,
 * focus restores to the triggering row. Content comes from `query incident(id:)`;
 * lifecycle transitions run `mutation updateIncidentStatus` with an optimistic
 * status-pill flip.
 */
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { gql, useMutation, useQuery } from '@apollo/client';
import { CheckCircle2, X } from 'lucide-react';
import {
  GqlChip,
  PartialBanner,
  Skeleton,
  SpinnerButton,
  StatusPill,
  severityTone,
  useToast,
} from '@/components';
import { cn } from '@/lib/utils';
import { sentenceCase, timeAgo } from '@/lib/format';
import type { Incident, IncidentStatus, UserError } from '@/graphql/types';
import { statusTone } from './statusTone';

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */
const INCIDENT = gql`
  query Incident($id: ID!) {
    incident(id: $id) {
      id
      ref
      title
      status
      severity
      assignee
      summary
      createdAt
      updatedAt
      tenant {
        id
        name
      }
      timeline {
        id
        timestamp
        actor
        kind
        detail
      }
    }
  }
`;

const UPDATE_INCIDENT_STATUS = gql`
  mutation UpdateIncidentStatus($id: ID!, $status: IncidentStatus!) {
    updateIncidentStatus(id: $id, status: $status) {
      incident {
        id
        ref
        status
        updatedAt
        timeline {
          id
          timestamp
          actor
          kind
          detail
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

interface IncidentResult {
  incident: Incident | null;
}
interface UpdateStatusResult {
  updateIncidentStatus: {
    incident: Pick<Incident, 'id' | 'ref' | 'status' | 'updatedAt' | 'timeline'> | null;
    userErrors: UserError[];
  };
}

interface Transition {
  target: IncidentStatus;
  label: string;
  variant: 'primary' | 'secondary' | 'calm';
}

const transitionsFor: Record<IncidentStatus, Transition[]> = {
  OPEN: [
    { target: 'INVESTIGATING', label: 'Start investigating', variant: 'primary' },
    { target: 'CONTAINED', label: 'Mark contained', variant: 'secondary' },
    { target: 'CLOSED', label: 'Close incident', variant: 'calm' },
  ],
  INVESTIGATING: [
    { target: 'CONTAINED', label: 'Mark contained', variant: 'primary' },
    { target: 'CLOSED', label: 'Close incident', variant: 'calm' },
  ],
  CONTAINED: [{ target: 'CLOSED', label: 'Close incident', variant: 'calm' }],
  CLOSED: [],
};

const dotClassFor: Record<string, string> = {
  CREATED: 'bg-sev-critical ring-4 ring-sev-critical-tint',
  AUTO_ACTION: 'bg-brand ring-4 ring-brand-tint',
  NOTE: 'bg-sev-medium ring-4 ring-sev-medium-tint',
  STATUS: 'bg-calm ring-4 ring-calm-tint',
};

function eventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ------------------------------------------------------------------ */
/* Drawer                                                              */
/* ------------------------------------------------------------------ */
export function IncidentDrawer({
  incidentId,
  open,
  onOpenChange,
}: {
  incidentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const incident = useQuery<IncidentResult>(INCIDENT, {
    variables: { id: incidentId ?? '' },
    // keep the query alive while closed so the slide-out animation keeps its content
    skip: incidentId == null,
  });
  const [updateStatus] = useMutation<UpdateStatusResult>(UPDATE_INCIDENT_STATUS);
  const [pendingTarget, setPendingTarget] = useState<IncidentStatus | null>(null);

  const data = incident.data?.incident ?? null;
  const timelinePartial = !!incident.error && !!incident.data;

  const transition = (target: IncidentStatus) => {
    if (!data) return;
    const now = new Date().toISOString();
    setPendingTarget(target);
    const optimisticResponse = {
      updateIncidentStatus: {
        __typename: 'IncidentPayload',
        incident: {
          __typename: 'Incident',
          id: data.id,
          ref: data.ref,
          status: target,
          updatedAt: now,
          timeline: [
            ...data.timeline,
            {
              __typename: 'IncidentEvent',
              id: `optimistic-${data.id}-${target}-${data.timeline.length}`,
              timestamp: now,
              actor: 'A. Kovač',
              kind: 'STATUS',
              detail: `Status changed to ${sentenceCase(target)}.`,
            },
          ],
        },
        userErrors: [],
      },
    } as UpdateStatusResult;
    void updateStatus({
      variables: { id: data.id, status: target },
      optimisticResponse,
    })
      .then((res) => {
        const errs = res.data?.updateIncidentStatus.userErrors ?? [];
        if (errs.length > 0) {
          toast({ tone: 'warning', title: 'Status not changed', description: errs[0].message });
          void incident.refetch();
          return;
        }
        toast({
          tone: 'success',
          title: `${data.ref} → ${sentenceCase(target)}`,
          description: 'mutation updateIncidentStatus confirmed · timeline entry added.',
        });
      })
      .catch(() => {
        toast({
          tone: 'warning',
          title: 'Status not changed',
          description: 'mutation updateIncidentStatus failed — try again.',
        });
      })
      .finally(() => setPendingTarget(null));
  };

  const transitions = data ? transitionsFor[data.status] : [];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-[rgba(30,27,34,.45)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[480px] flex-col bg-white shadow-card-lg duration-200 data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right"
          aria-describedby={undefined}
        >
          {/* header */}
          <div className="flex items-start justify-between border-b border-line-soft px-6 pt-5 pb-4">
            {incident.loading && !data ? (
              <div className="w-full space-y-2 pr-8" aria-busy="true">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ) : data ? (
              <div className="min-w-0 pr-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono text-[12px] text-ink-3">{data.ref}</span>
                  <StatusPill tone={severityTone(data.severity)}>{sentenceCase(data.severity)}</StatusPill>
                  <StatusPill tone={statusTone(data.status)} dot>
                    {sentenceCase(data.status)}
                  </StatusPill>
                </div>
                <Dialog.Title className="font-display mt-2 text-[17px] font-semibold">
                  {data.title}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-[12.5px] text-ink-3">
                  {data.tenant.name} · opened {timeAgo(data.createdAt)} ago · assignee{' '}
                  <span className="font-medium text-ink-2">{data.assignee ?? 'Unassigned'}</span>
                </Dialog.Description>
              </div>
            ) : (
              <Dialog.Title className="font-display text-[17px] font-semibold">Incident</Dialog.Title>
            )}
            <Dialog.Close
              className="grid h-8 w-8 flex-none place-items-center rounded-[10px] text-ink-2 hover:bg-[#FCFBF8]"
              aria-label="Close incident details"
            >
              <X size={15} aria-hidden="true" />
            </Dialog.Close>
          </div>

          {/* body */}
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {incident.error && !incident.data ? (
              <PartialBanner
                title="Incident didn’t load"
                field="incident(id:)"
                onRetry={() => void incident.refetch()}
              />
            ) : data ? (
              <>
                {/* status transitions */}
                <section aria-label="Status transitions">
                  <div className="mb-2.5 flex items-center justify-between">
                    <h3 className="font-display text-[13.5px] font-semibold">Move it forward</h3>
                    <GqlChip kind="mutation">mutation updateIncidentStatus</GqlChip>
                  </div>
                  {transitions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {transitions.map((t) => (
                        <SpinnerButton
                          key={t.target}
                          variant={t.variant === 'calm' ? 'secondary' : t.variant}
                          size="sm"
                          loading={pendingTarget === t.target}
                          spinnerLabel="Updating…"
                          disabled={pendingTarget != null}
                          className={cn(
                            t.variant === 'calm' &&
                              '!border-transparent !bg-calm !text-white hover:!bg-[#186245]',
                          )}
                          onClick={() => transition(t.target)}
                        >
                          {t.label}
                        </SpinnerButton>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12.5px] text-ink-3">
                      Closed — the lifecycle is complete. It stays in the audit log.
                    </p>
                  )}
                  <p className="mt-2 text-[11.5px] text-ink-3">
                    Lifecycle: Open → Investigating → Contained → Closed. Every transition is logged in the
                    timeline.
                  </p>
                </section>

                {/* summary */}
                <section aria-label="Incident summary">
                  <h3 className="font-display mb-2 text-[13.5px] font-semibold">What we know</h3>
                  <p className="text-[13px] leading-relaxed text-ink-2">{data.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill tone="neutral">{data.tenant.name}</StatusPill>
                    <StatusPill tone={severityTone(data.severity)}>{sentenceCase(data.severity)}</StatusPill>
                    {data.timeline.some((e) => e.kind === 'AUTO_ACTION') && (
                      <StatusPill tone="calm">Engine already acted</StatusPill>
                    )}
                  </div>
                </section>

                {/* timeline */}
                <section aria-label="Timeline">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-display text-[13.5px] font-semibold">Timeline</h3>
                    <GqlChip kind="query">query incident(id:).timeline</GqlChip>
                  </div>
                  {timelinePartial && (
                    <div className="mb-3">
                      <PartialBanner
                        title="Timeline unavailable"
                        field="incident.timeline"
                        message="The incident itself loaded fine — only the timeline failed to resolve."
                        onRetry={() => void incident.refetch()}
                      />
                    </div>
                  )}
                  {data.timeline.length === 0 ? (
                    <p className="text-[12.5px] text-ink-3">No timeline events yet.</p>
                  ) : (
                    <ol className="relative ml-2 space-y-5 border-l-2 border-line">
                      {data.timeline.map((e) => {
                        const checked = e.kind === 'AUTO_ACTION' || e.kind === 'STATUS';
                        return (
                          <li key={e.id} className="relative pl-5">
                            <span
                              className={cn(
                                'absolute top-1 -left-[7px] h-3 w-3 rounded-full',
                                dotClassFor[e.kind] ?? 'bg-brand ring-4 ring-brand-tint',
                              )}
                              aria-hidden="true"
                            />
                            <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                              {checked && (
                                <CheckCircle2 size={13} className="flex-none text-calm" aria-hidden="true" />
                              )}
                              {sentenceCase(e.kind)}
                              <span className="font-normal text-ink-3">· {e.actor}</span>
                            </p>
                            <p className="mt-0.5 text-[12px] text-ink-3">{e.detail}</p>
                            <p className="mono mt-0.5 text-[11px] text-ink-3">
                              {eventTime(e.timestamp)} · {timeAgo(e.timestamp)} ago
                            </p>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
              </>
            ) : incident.loading ? (
              <div className="space-y-5" aria-busy="true">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <div className="flex gap-2">
                    <Skeleton className="h-[30px] w-32 !rounded-lg" />
                    <Skeleton className="h-[30px] w-28 !rounded-lg" />
                    <Skeleton className="h-[30px] w-24 !rounded-lg" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-4 w-20" />
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="space-y-1.5">
                      <Skeleton className="h-3 w-2/5" />
                      <Skeleton className="h-3 w-4/5" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-ink-3">This incident no longer exists.</p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default IncidentDrawer;
