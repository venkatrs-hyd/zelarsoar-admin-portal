/**
 * CreateIncidentDialog — "New incident" modal for `/incidents`.
 * Radix Dialog (focus trap + ESC + focus restore). Submits `mutation createIncident`;
 * payload userErrors are mapped back to inline field errors (design.md §7.6).
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { gql, useMutation, useQuery } from '@apollo/client';
import { X } from 'lucide-react';
import { Skeleton, SpinnerButton, useToast } from '@/components';
import { cn } from '@/lib/utils';
import { sentenceCase } from '@/lib/format';
import type { Connection, Incident, Severity, Tenant, UserError } from '@/graphql/types';

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */
const TENANTS_FOR_SELECT = gql`
  query TenantsForSelect($first: Int) {
    tenants(first: $first) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

const CREATE_INCIDENT = gql`
  mutation CreateIncident($input: CreateIncidentInput!) {
    createIncident(input: $input) {
      incident {
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
      }
      userErrors {
        field
        message
      }
    }
  }
`;

interface TenantsResult {
  tenants: Connection<Pick<Tenant, 'id' | 'name'>>;
}
interface CreateResult {
  createIncident: { incident: Incident | null; userErrors: UserError[] };
}

const severities: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const inputClass =
  'h-[38px] w-full rounded-[10px] border border-line bg-white px-3 text-[13.5px] text-ink';

/** userErrors.field → form field key ("tenantId" is the Source select). */
function fieldKey(field: string | null): string {
  if (field === 'tenantId') return 'source';
  return field ?? 'form';
}

export function CreateIncidentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const tenants = useQuery<TenantsResult>(TENANTS_FOR_SELECT, {
    variables: { first: 25 },
    skip: !open,
  });
  const [createIncident] = useMutation<CreateResult>(CREATE_INCIDENT);

  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<Severity>('HIGH');
  const [source, setSource] = useState('');
  const [summary, setSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const tenantOptions = tenants.data?.tenants.edges.map((e) => e.node) ?? [];
  const effectiveSource = source || tenantOptions[0]?.id || '';

  const reset = () => {
    setTitle('');
    setSeverity('HIGH');
    setSource('');
    setSummary('');
    setErrors({});
    setSaving(false);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrors({});
    void createIncident({
      variables: {
        input: {
          title,
          severity,
          tenantId: effectiveSource,
          summary: summary.trim() || undefined,
        },
      },
      refetchQueries: ['Incidents'],
    })
      .then((res) => {
        const payload = res.data?.createIncident;
        const errs = payload?.userErrors ?? [];
        if (errs.length > 0 || !payload?.incident) {
          const map: Record<string, string> = {};
          errs.forEach((ue) => {
            map[fieldKey(ue.field)] = ue.message;
          });
          if (errs.length === 0) map.form = 'The gateway returned no incident.';
          setErrors(map);
          return;
        }
        toast({
          tone: 'success',
          title: `${payload.incident.ref} created`,
          description: 'mutation createIncident confirmed — it is now Open at the top of the list.',
        });
        reset();
        onOpenChange(false);
      })
      .catch(() => {
        setErrors({ form: 'mutation createIncident failed — your draft is still here, try again.' });
      })
      .finally(() => setSaving(false));
  };

  const fieldError = (key: string) =>
    errors[key] ? (
      <p id={`ci-${key}-err`} className="mt-1 text-[12px] font-medium text-sev-critical-ink" role="alert">
        {errors[key]}
      </p>
    ) : null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-[rgba(30,27,34,.45)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-[70] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-card border border-line bg-white p-6 shadow-card-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          aria-describedby={undefined}
        >
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="font-display text-[17px] font-semibold">New incident</Dialog.Title>
              <Dialog.Description className="mt-1 text-[12.5px] text-ink-3">
                Opens as Open and lands at the top of the list. The engine keeps watching either way.
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="grid h-8 w-8 flex-none place-items-center rounded-[10px] text-ink-2 hover:bg-[#FCFBF8]"
              aria-label="Close new incident dialog"
            >
              <X size={15} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <form className="mt-4 space-y-4" onSubmit={onSubmit} noValidate>
            <div>
              <label htmlFor="ci-title" className="mb-1 block text-[12px] font-medium">
                Title
              </label>
              <input
                id="ci-title"
                className={cn(inputClass, errors.title && 'border-sev-critical')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="SSH brute-force campaign against VPS nodes"
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? 'ci-title-err' : undefined}
              />
              {fieldError('title')}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ci-severity" className="mb-1 block text-[12px] font-medium">
                  Severity
                </label>
                <select
                  id="ci-severity"
                  className={inputClass}
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as Severity)}
                >
                  {severities.map((s) => (
                    <option key={s} value={s}>
                      {sentenceCase(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ci-source" className="mb-1 block text-[12px] font-medium">
                  Source
                </label>
                {tenants.loading && tenantOptions.length === 0 ? (
                  <Skeleton className="h-[38px] w-full !rounded-[10px]" />
                ) : (
                  <select
                    id="ci-source"
                    className={cn(inputClass, errors.source && 'border-sev-critical')}
                    value={effectiveSource}
                    onChange={(e) => setSource(e.target.value)}
                    aria-invalid={!!errors.source}
                    aria-describedby={errors.source ? 'ci-source-err' : undefined}
                  >
                    {tenantOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
                {fieldError('source')}
              </div>
            </div>

            <div>
              <label htmlFor="ci-summary" className="mb-1 block text-[12px] font-medium">
                Summary <span className="font-normal text-ink-3">(optional)</span>
              </label>
              <textarea
                id="ci-summary"
                rows={3}
                className="w-full rounded-[10px] border border-line bg-white px-3 py-2 text-[13.5px] text-ink"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="What should the next person know?"
              />
            </div>

            {errors.form && (
              <p className="text-[12px] font-medium text-sev-critical-ink" role="alert">
                {errors.form}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Dialog.Close asChild>
                <button type="button" className="btn btn-ghost btn-sm">
                  Cancel
                </button>
              </Dialog.Close>
              <SpinnerButton type="submit" variant="primary" loading={saving} spinnerLabel="Creating…">
                Create incident
              </SpinnerButton>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default CreateIncidentDialog;
