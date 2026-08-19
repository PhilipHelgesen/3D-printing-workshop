import { Modal } from '../ui/Modal.tsx';
import s from '../ui/modal.module.css';

export function DeleteBuildModal({
  name,
  partCount,
  onConfirm,
  onClose,
}: {
  name: string;
  partCount: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title="Delete project"
      subtitle={`${partCount} ${partCount === 1 ? 'part' : 'parts'} go with it`}
      onClose={onClose}
      footer={
        <div className={s.actions}>
          <button className={s.cancel} onClick={onClose}>
            Cancel
          </button>
          <button className={s.destroy} onClick={onConfirm}>
            Delete
          </button>
        </div>
      }
    >
      <div className={s.confirmText}>
        You are now deleting <strong>{name}</strong>. This cannot be undone.
      </div>
    </Modal>
  );
}
