import { useState } from 'react';
import { DndContext, PointerSensor, closestCenter, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import type { Build, Step, StepColor } from '../types.ts';
import { STEP_COLORS, countByStatus } from '../derive.ts';
import { editBuildSteps, reorderStep, stepReplacements } from '../workshop.ts';
import { Modal } from '../ui/Modal.tsx';
import { StageContents } from './StageFlow.tsx';
import m from '../ui/modal.module.css';
import s from './build.module.css';

function EditableStage({ step, count, selected, onPick }: {
  step: Step; count: number; selected: boolean; onPick: () => void;
}) {
  const fixed = step.id === 'done';
  const drag = useDraggable({ id: step.id, disabled: fixed });
  const drop = useDroppable({ id: step.id, disabled: fixed });
  return (
    <div ref={(node) => { drag.setNodeRef(node); drop.setNodeRef(node); }}
      className={`${s.editorStage} ${drop.isOver ? s.editorOver : ''}`}
      style={drag.transform ? { transform: `translate(${drag.transform.x}px, ${drag.transform.y}px)`, zIndex: 1 } : undefined}>
      <button className={`${s.stage} ${selected ? s.stageOn : ''}`} aria-pressed={selected} onClick={onPick}>
        <StageContents step={step} count={count} editing />
      </button>
      {fixed ? <span className={s.fixedStep}>Fixed</span> : (
        <button className={s.stepHandle} ref={drag.setActivatorNodeRef}
          {...drag.listeners} {...drag.attributes} aria-label={`Drag ${step.name} to reorder`}>
          ↔
        </button>
      )}
    </div>
  );
}

export function StepsModal({ build, onSave, onClose }: {
  build: Build;
  onSave: (steps: Step[], replacements: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(build);
  const [selected, setSelected] = useState(build.steps[0].id);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<StepColor>('sea');
  const [deleting, setDeleting] = useState(false);
  const [replacement, setReplacement] = useState('');
  const [error, setError] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const step = draft.steps.find((candidate) => candidate.id === selected)!;
  const count = countByStatus(draft.parts, selected);

  const pick = (id: string) => {
    setSelected(id);
    setAdding(false);
    setDeleting(false);
    setError('');
  };
  const change = (patch: Partial<Step>) => {
    setDraft((current) => ({ ...current, steps: current.steps.map((item) => item.id === selected ? { ...item, ...patch } : item) }));
    setError('');
  };
  const reorder = (id: string, target: string) =>
    setDraft((current) => ({ ...current, steps: reorderStep(current.steps, id, target) }));

  const add = () => {
    if (!name.trim()) return;
    const added: Step = { id: crypto.randomUUID(), name: name.trim(), color };
    setDraft((current) => ({ ...current, steps: [...current.steps.slice(0, -1), added, current.steps.at(-1)!] }));
    pick(added.id);
  };
  const remove = () => {
    try {
      const next = editBuildSteps(draft, draft.steps.filter((item) => item.id !== selected), { [selected]: replacement });
      setDraft(next);
      pick(next.steps[0].id);
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  const save = () => {
    try {
      const replacements = stepReplacements(build, draft);
      const checked = editBuildSteps(build, draft.steps, replacements);
      onSave(checked.steps, replacements);
    } catch (cause) {
      setError((cause as Error).message);
    }
  };

  return (
    <Modal title="Edit steps" subtitle={build.name} wide onClose={onClose}
      footer={<div className={m.actions}>
        <button className={m.cancel} onClick={onClose}>Cancel</button>
        <button className={m.save} disabled={adding || deleting} onClick={save}>Save</button>
      </div>}>
      <div className={s.flowHeading}>
        <span className={m.kicker}>PARTS NEEDING EACH STEP</span>
        <button className={m.cancel} onClick={() => { setAdding(true); setDeleting(false); setName(''); setError(''); }}>+ Add step</button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => { if (over) reorder(String(active.id), String(over.id)); }}>
        <div className={`${s.flow} ${s.editorFlow}`}>
          {draft.steps.map((item) => <EditableStage key={item.id} step={item}
            count={countByStatus(draft.parts, item.id)} selected={!adding && selected === item.id}
            onPick={() => pick(item.id)} />)}
        </div>
      </DndContext>

      {adding || step.id !== 'done' ? (
        <div className={s.stepFields}>
          <label className={m.kicker} htmlFor="step-name">{adding ? 'NEW STEP NAME' : 'STEP NAME'}</label>
          <input id="step-name" className={m.field} autoFocus value={adding ? name : step.name}
            placeholder="e.g. Graphite after clear coat"
            onChange={(event) => adding ? setName(event.target.value) : change({ name: event.target.value })}
            onKeyDown={(event) => { if (event.key === 'Enter' && adding) add(); }} />
          <div className={`${m.kicker} ${m.kickerSpaced}`}>COLOR</div>
          <div className={s.stepSwatches} role="group" aria-label="Step color">
            {STEP_COLORS.map((swatch) => <button key={swatch.id}
              className={s.colorSwatch} style={{ background: `var(--${swatch.id}-tint)`, borderColor: (adding ? color : step.color) === swatch.id ? 'var(--ink)' : 'transparent' }}
              aria-label={swatch.name} aria-pressed={(adding ? color : step.color) === swatch.id}
              onClick={() => adding ? setColor(swatch.id) : change({ color: swatch.id })}>
              <span style={{ background: `var(--${swatch.id})` }} />
            </button>)}
          </div>
          <div className={s.stepActions}>
            {adding ? <>
              <button className={m.cancel} onClick={() => setAdding(false)}>Cancel new step</button>
              <button className={m.save} disabled={!name.trim()} onClick={add}>Add step</button>
            </> : <>
              <button className={m.cancel} disabled={draft.steps[0].id === selected}
                aria-label={`Move ${step.name} left`} onClick={() => reorder(selected, draft.steps[draft.steps.indexOf(step) - 1].id)}>← Move left</button>
              <button className={m.cancel} disabled={draft.steps.at(-2)?.id === selected}
                aria-label={`Move ${step.name} right`} onClick={() => reorder(selected, draft.steps[draft.steps.indexOf(step) + 1].id)}>Move right →</button>
              <button className={m.delete} disabled={draft.steps.length === 2 || deleting}
                onClick={() => { setDeleting(true); setReplacement(''); }}>Delete step</button>
            </>}
          </div>
          {deleting && <div className={s.stepDeletion}>
            <p>{count ? `${count} ${count === 1 ? 'part needs' : 'parts need'} ${step.name}. Choose where to move ${count === 1 ? 'it' : 'them'}.` : `No parts need ${step.name}.`}</p>
            {count > 0 && <label>
              <span className={m.kicker}>REPLACEMENT STEP</span>
              <select className={m.field} value={replacement} onChange={(event) => setReplacement(event.target.value)}>
                <option value="">Choose a step</option>
                {draft.steps.filter((item) => item.id !== selected).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>}
            <div className={s.stepActions}>
              <button className={m.cancel} onClick={() => setDeleting(false)}>Keep step</button>
              <button className={m.destroy} disabled={count > 0 && !replacement} onClick={remove}>Delete step{count > 0 ? ` and move ${count} ${count === 1 ? 'part' : 'parts'}` : ''}</button>
            </div>
          </div>}
        </div>
      ) : <p className={m.confirmText}>Done marks finished parts and stays fixed at the end.</p>}
      {error && <p className={m.iconError} role="alert">{error}</p>}
    </Modal>
  );
}
