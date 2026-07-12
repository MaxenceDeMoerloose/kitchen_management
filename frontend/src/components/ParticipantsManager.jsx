import { useState } from "react";
import { useApp } from "../store.jsx";
import { TrashIcon } from "./icons.jsx";

export default function ParticipantsManager() {
  const { participants, addParticipant, renameParticipant, deleteParticipant } = useApp();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addParticipant(name);
      setName("");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(p) {
    setEditingId(p.id);
    setEditingName(p.name);
  }

  function confirmEdit() {
    renameParticipant(editingId, editingName);
    setEditingId(null);
  }

  return (
    <div className="card">
      <h2>👥 Participants</h2>
      <ul className="participants-list">
        {participants.map((p) => (
          <li key={p.id}>
            {editingId === p.id ? (
              <>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirmEdit()}
                  autoFocus
                />
                <button className="btn-icon" onClick={confirmEdit} aria-label="Valider">
                  ✓
                </button>
              </>
            ) : (
              <>
                <span onClick={() => startEdit(p)}>{p.name}</span>
                <button
                  className="btn-icon"
                  onClick={() => {
                    if (confirm(`Supprimer ${p.name} ?`)) deleteParticipant(p.id);
                  }}
                  aria-label="Supprimer"
                >
                  <TrashIcon />
                </button>
              </>
            )}
          </li>
        ))}
        {participants.length === 0 && <li className="empty-message">Aucun participant pour l'instant.</li>}
      </ul>
      <form className="participants-add" onSubmit={submit}>
        <input type="text" placeholder="Ajouter un participant…" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          ＋
        </button>
      </form>
    </div>
  );
}
