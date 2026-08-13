import { useState } from 'react';
import type { ToolboxEntry } from './types.ts';
import { useStore } from './store.ts';
import { Dashboard } from './screens/Dashboard.tsx';
import { BuildDetail } from './screens/BuildDetail.tsx';
import { Toolbox } from './screens/Toolbox.tsx';
import { ToolboxModal } from './screens/ToolboxModal.tsx';
import { AddPartModal } from './screens/AddPartModal.tsx';
import { type Screen } from './ui/Shell.tsx';

const blankEntry = (): ToolboxEntry => ({
  id: crypto.randomUUID(),
  kind: 'tool',
  name: '',
  iconId: 'a',
  favorite: false,
});

export default function App() {
  const store = useStore();
  const { builds, toolbox } = store.state;
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [openBuildId, setOpenBuildId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ entry: ToolboxEntry; isNew: boolean } | null>(null);
  const [addingPart, setAddingPart] = useState(false);

  const navigate = (next: Screen) => {
    setOpenBuildId(null);
    setScreen(next);
  };

  const openBuild = builds.find((b) => b.id === openBuildId);

  const ask = (question: string, current = '', run: (value: string) => void) => {
    const value = window.prompt(question, current);
    if (value !== null && value.trim()) run(value.trim());
  };

  return (
    <>
      {screen === 'dashboard' && openBuild && (
        <BuildDetail
          build={openBuild}
          builds={builds}
          onNavigate={navigate}
          onBack={() => setOpenBuildId(null)}
          onAddPart={() => setAddingPart(true)}
          onRenameBuild={(name) => store.renameBuild(openBuild.id, name)}
          onMove={store.moveTo}
          onAdvance={store.advance}
          onRename={(id) => {
            const part = openBuild.parts.find((p) => p.id === id)!;
            ask('Rename part', part.name, (name) => store.renamePart(id, name));
          }}
          onNote={(id) => {
            const part = openBuild.parts.find((p) => p.id === id)!;
            const note = window.prompt('Notes & details', part.note ?? '');
            if (note !== null) store.setNote(id, note.trim());
          }}
          onDelete={(id) => {
            const part = openBuild.parts.find((p) => p.id === id)!;
            if (window.confirm(`Delete ${part.name}?`)) store.deletePart(id);
          }}
        />
      )}

      {screen === 'dashboard' && !openBuild && (
        <Dashboard
          builds={builds}
          onNavigate={navigate}
          onOpenBuild={setOpenBuildId}
          onNewBuild={() => ask('Name the new build', '', store.addBuild)}
          onBatch={store.advance}
        />
      )}

      {screen === 'toolbox' && (
        <Toolbox
          entries={toolbox}
          onNavigate={navigate}
          onToggleFavorite={store.toggleFavorite}
          onEdit={(entry) => setModal({ entry, isNew: false })}
          onCreate={() => setModal({ entry: blankEntry(), isNew: true })}
        />
      )}

      {addingPart && openBuild && (
        <AddPartModal
          onAdd={(name, note) => {
            store.addPart(openBuild.id, name, note);
            setAddingPart(false);
          }}
          onClose={() => setAddingPart(false)}
        />
      )}

      {modal && (
        <ToolboxModal
          entry={modal.entry}
          isNew={modal.isNew}
          onSave={(entry) => {
            store.saveEntry(entry);
            setModal(null);
          }}
          onDelete={(id) => {
            store.deleteEntry(id);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
