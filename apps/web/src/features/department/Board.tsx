import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import { type KeyboardEventHandler, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EscalationBadge } from '@/components/EscalationBadge';
import { SlaBadge } from '@/components/SlaBadge';
import { StatusChip } from '@/components/StatusChip';
import { useAuth } from '@/features/auth/store';
import { useRequestTitle } from '@/features/citizen/ComplaintCard';
import { usePlaceLabel } from '@/features/report/LocationStep';
import { ActionForm } from '@/features/request-detail/ActionForm';
import { type StaffRequest, useStaffAct, useStaffRequests, useTransitions } from '@/features/request-detail/hooks';
import { Modal } from '@/features/request-detail/Modal';
import { allowedActions } from '@/features/request-detail/useAllowedActions';
import type { State } from '@/lib/rpc';
import { cn } from '@/lib/utils';

const COLUMNS: State[] = ['TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'NEEDS_INFO', 'RESOLVED', 'REOPENED', 'CLOSED'];

/** The action a drop onto a column means. Every drop goes to the engine, so invalid ones are refused and logged. */
export function dropAction(from: State, to: State) {
  if (to === 'ASSIGNED') return from === 'ASSIGNED' || from === 'IN_PROGRESS' ? 'reassign' : 'assign';
  return {
    TRIAGED: 'triage',
    IN_PROGRESS: 'start',
    NEEDS_INFO: 'request_info',
    RESOLVED: 'resolve',
    REOPENED: 'reopen',
    CLOSED: 'confirm',
  }[to as string]!;
}

/** Dept Head Kanban. Cards snap back unless the engine accepts the move. */
export function Board() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.profile);
  const { data } = useStaffRequests();
  const { data: transitions } = useTransitions();
  const { act } = useStaffAct();
  const [form, setForm] = useState<{ r: StaffRequest; action: string; requires: string[] } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const r = data?.find((x) => x.id === active.id);
    const to = over?.id as State | undefined;
    if (!r || !to || !me || to === r.state) return;
    const action = dropAction(r.state, to);
    const allowed = allowedActions(transitions ?? [], r, me).find((x) => x.action === action);
    // Allowed and needs input (officer, reason) → ask first; otherwise send as is and let the engine decide.
    if (allowed?.requires.length) setForm({ r, action, requires: allowed.requires });
    else void act(r, action, {}, t(`staff.done.${action}`));
  };

  return (
    <section className="space-y-4">
      <h1 className="text-3xl">{t('nav.board')}</h1>
      <p className="text-sm text-ink-muted">{t('staff.boardHint')}</p>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {COLUMNS.map((s) => (
            <Column key={s} state={s} cards={(data ?? []).filter((r) => r.state === s)} />
          ))}
        </div>
      </DndContext>
      {form && (
        <Modal title={`${t(`staff.action.${form.action}`)} · ${form.r.ticket_no}`} onClose={() => setForm(null)}>
          <ActionForm r={form.r} action={form.action} requires={form.requires} onDone={() => setForm(null)} />
        </Modal>
      )}
    </section>
  );
}

function Column({ state, cards }: { state: State; cards: StaffRequest[] }) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: state });
  // Closed is a drop target and a short recent list, not an archive.
  const shown = state === 'CLOSED' ? cards.slice(-5) : cards;
  return (
    <div
      ref={setNodeRef}
      aria-label={t(`state.${state}`)}
      className={cn('card min-w-[11rem] flex-1 space-y-2 p-2 ring-nmc-600', isOver && 'ring-2')}
    >
      <h2 className="flex items-center justify-between px-1 text-base">
        <StatusChip state={state} />
        <span className="tabular text-sm text-ink-muted">{cards.length}</span>
      </h2>
      <ul className="min-h-24 space-y-2">
        {shown.map((r) => (
          <Card key={r.id} r={r} />
        ))}
      </ul>
    </div>
  );
}

function Card({ r }: { r: StaffRequest }) {
  const { t } = useTranslation();
  const title = useRequestTitle(r);
  const place = usePlaceLabel(r);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: r.id,
  });
  // Pointer drag works anywhere on the card; keyboard drag starts from the handle, so the ticket link stays a
  // plain link (no interactive element nested inside another).
  const { onKeyDown, ...pointer } = listeners ?? {};
  return (
    <li
      ref={setNodeRef}
      {...pointer}
      style={{
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        // Snap back when a drop is refused (off under prefers-reduced-motion).
        transition: isDragging ? undefined : 'transform 200ms ease-out',
      }}
      className={cn(
        'cursor-grab space-y-1 rounded-md border border-line bg-paper p-2 text-sm',
        isDragging && 'relative z-10 shadow-lg',
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <Link to={`/requests/${r.id}`} className="tabular font-semibold text-nmc hover:underline">
          {r.ticket_no}
        </Link>
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          onKeyDown={onKeyDown as KeyboardEventHandler}
          aria-label={t('staff.moveCard', { ticket: r.ticket_no })}
          className="-m-1 flex h-11 w-11 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-surface"
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <p className="font-medium">{title}</p>
      <p className="text-ink-muted">{place}</p>
      <div className="flex flex-wrap gap-1">
        <SlaBadge status={r.sla_status_of} dueAt={r.resolution_due_at} />
        <EscalationBadge level={r.escalation_level} />
      </div>
      {r.officer?.full_name && <p className="text-ink-muted">{r.officer.full_name}</p>}
    </li>
  );
}
