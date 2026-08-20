import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Part, Screen, ToolboxEntry } from './types.ts';
import { useStore } from './store.ts';
import { supabase } from './supabase.ts';
import { SignIn } from './ui/SignIn.tsx';
import { Dashboard } from './screens/Dashboard.tsx';
import { BuildDetail } from './screens/BuildDetail.tsx';
import { Toolbox } from './screens/Toolbox.tsx';
import { ToolboxModal } from './screens/ToolboxModal.tsx';
import { AddPartModal } from './screens/AddPartModal.tsx';
import { LinkPartModal } from './screens/LinkPartModal.tsx';
import { DeleteBuildModal } from './screens/DeleteBuildModal.tsx';

const blankEntry = (): ToolboxEntry => ({
  id: crypto.randomUUID(),
  kind: 'tool',
  name: '',
  iconId: 'a',
  favorite: false,
});

/**
 * Session gate. `undefined` means the stored session hasn't been read back yet
 * — distinct from `null` (definitely signed out), so a returning maker never
 * gets a flash of the sign-in form before their session restores.
 *
 * Workshop mounts only once there is a session, which also keeps useStore's
 * cloud pull from firing as `anon` and quietly failing.
 */
export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  return session ? <Workshop /> : <SignIn />;
}

function Workshop() {
  const store = useStore();
  const { builds, toolbox } = store.state;
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [openBuildId, setOpenBuildId] = useState<string | null>(null);
  const [entryModal, setEntryModal] = useState<{ entry: ToolboxEntry; isNew: boolean } | null>(null);
  const [addingPart, setAddingPart] = useState(false);
  const [linkingPartId, setLinkingPartId] = useState<string | null>(null);
  const [deletingBuild, setDeletingBuild] = useState(false);

  const navigate = (next: Screen) => {
    setOpenBuildId(null);
    setScreen(next);
  };

  const openBuild = builds.find((b) => b.id === openBuildId);
  const linkingPart = openBuild?.parts.find((p) => p.id === linkingPartId);
  const assemblyMembers = linkingPart?.linkGroupId
    ? openBuild!.parts.filter((p) => p.id !== linkingPart.id && p.linkGroupId === linkingPart.linkGroupId)
    : [];

  const ask = (question: string, current: string, run: (value: string) => void) => {
    const value = window.prompt(question, current);
    if (value !== null && value.trim()) run(value.trim());
  };

  // ponytail: rename/note/delete still use native prompts — a modal each is only
  // worth building when one of them needs more than a single field.
  const rowActions = {
    onMove: store.moveTo,
    onRename: (part: Part) => ask('Rename part', part.name, (name) => store.renamePart(part.id, name)),
    onNote: (part: Part) => {
      const note = window.prompt('Notes & details', part.note ?? '');
      if (note !== null) store.setNote(part.id, note.trim());
    },
    onDelete: (part: Part) => {
      if (window.confirm(`Delete ${part.name}?`)) store.deletePart(part.id);
    },
  };

  return (
    <>
      {screen === 'dashboard' &&
        (openBuild ? (
          <BuildDetail
            // Remount on a different build so per-build view state can't leak across.
            key={openBuild.id}
            build={openBuild}
            builds={builds}
            onNavigate={navigate}
            onBack={() => setOpenBuildId(null)}
            onAddPart={() => setAddingPart(true)}
            onRenameBuild={(name) => store.renameBuild(openBuild.id, name)}
            onDeleteBuild={() => setDeletingBuild(true)}
            onAdvance={store.advance}
            onLinkPart={setLinkingPartId}
            rowActions={rowActions}
          />
        ) : (
          <Dashboard
            builds={builds}
            onNavigate={navigate}
            onOpenBuild={setOpenBuildId}
            onNewBuild={() => ask('Name the new build', '', store.addBuild)}
          />
        ))}

      {screen === 'toolbox' && (
        <Toolbox
          entries={toolbox}
          onNavigate={navigate}
          onToggleFavorite={store.toggleFavorite}
          onEdit={(entry) => setEntryModal({ entry, isNew: false })}
          onCreate={() => setEntryModal({ entry: blankEntry(), isNew: true })}
        />
      )}

      {deletingBuild && openBuild && (
        <DeleteBuildModal
          name={openBuild.name}
          partCount={openBuild.parts.length}
          onConfirm={() => {
            store.deleteBuild(openBuild.id);
            setDeletingBuild(false);
            setOpenBuildId(null); // the screen behind it is gone — fall back to the dashboard
          }}
          onClose={() => setDeletingBuild(false)}
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

      {linkingPart && openBuild && (
        <LinkPartModal
          part={linkingPart}
          members={assemblyMembers}
          candidates={openBuild.parts.filter(
            (p) => p.id !== linkingPart.id && !assemblyMembers.some((m) => m.id === p.id),
          )}
          onAdd={(newIds) =>
            store.linkParts([linkingPart.id, ...assemblyMembers.map((m) => m.id), ...newIds])
          }
          onRemoveMember={store.removeFromGroup}
          onClose={() => setLinkingPartId(null)}
        />
      )}

      {entryModal && (
        <ToolboxModal
          entry={entryModal.entry}
          isNew={entryModal.isNew}
          onSave={(entry) => {
            store.saveEntry(entry);
            setEntryModal(null);
          }}
          onDelete={(id) => {
            store.deleteEntry(id);
            setEntryModal(null);
          }}
          onClose={() => setEntryModal(null)}
        />
      )}
    </>
  );
}
