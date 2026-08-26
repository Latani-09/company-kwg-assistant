import { useEffect, useRef, useState, type FormEvent } from "react";
import { askQuestion } from "../api/chat";
import { createEntry, deleteEntry, listEntries } from "../api/knowledge";
import { listSectors } from "../api/sectors";
import type { ChatSource, QAEntry, Sector } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { AppHeader } from "../components/AppHeader";
import { Modal } from "../components/Modal";

interface ChatMessage {
  id: number;
  sender: "user" | "assistant";
  text: string;
  isGap?: boolean;
  sources?: ChatSource[];
}

let messageId = 0;

export function DashboardPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superAdmin";
  const [allSectors, setAllSectors] = useState<Sector[]>([]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    listSectors()
      .then(setAllSectors)
      .catch(() => setAllSectors([]));
  }, [isSuperAdmin]);

  // SuperAdmins have update access to every sector, not just ones they're assigned to.
  const sectors: Sector[] = isSuperAdmin ? allSectors : user?.sectors ?? [];
  const showKnowledgeBase = sectors.length > 0;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: messageId++,
      sender: "assistant",
      text: "Hello. I am your company knowledge assistant. Ask me anything about internal documentation, policies, or technical specs.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [asking, setAsking] = useState(false);
  const chatHistoryRef = useRef<HTMLDivElement>(null);

  const [activeSectorId, setActiveSectorId] = useState<string | null>(sectors[0]?.id ?? null);
  const [docs, setDocs] = useState<QAEntry[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [addDocOpen, setAddDocOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docSectorId, setDocSectorId] = useState(sectors[0]?.id ?? "");
  const [docContent, setDocContent] = useState("");
  const [docSource, setDocSource] = useState("");
  const [savingDoc, setSavingDoc] = useState(false);

  useEffect(() => {
    if (!activeSectorId && sectors.length > 0) {
      setActiveSectorId(sectors[0].id);
    }
  }, [sectors, activeSectorId]);

  useEffect(() => {
    if (!activeSectorId) {
      setDocs([]);
      return;
    }
    setDocsLoading(true);
    listEntries(activeSectorId)
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setDocsLoading(false));
  }, [activeSectorId]);

  useEffect(() => {
    chatHistoryRef.current?.scrollTo({ top: chatHistoryRef.current.scrollHeight });
  }, [messages]);

  async function handleChatSubmit(e: FormEvent) {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || asking) return;
    setMessages((prev) => [...prev, { id: messageId++, sender: "user", text }]);
    setChatInput("");
    setAsking(true);
    try {
      const response = await askQuestion(text);
      setMessages((prev) => [
        ...prev,
        response.is_gap
          ? {
              id: messageId++,
              sender: "assistant",
              text: "I don't have information on that in my current knowledge base. I have flagged this gap for review.",
              isGap: true,
            }
          : {
              id: messageId++,
              sender: "assistant",
              text: response.answer ?? "",
              sources: response.sources,
            },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: messageId++, sender: "assistant", text: "Something went wrong reaching the assistant. Please try again." },
      ]);
    } finally {
      setAsking(false);
    }
  }

  function openAddDoc() {
    setDocTitle("");
    setDocSectorId(activeSectorId ?? sectors[0]?.id ?? "");
    setDocContent("");
    setDocSource("");
    setAddDocOpen(true);
  }

  async function handleAddDoc(e: FormEvent) {
    e.preventDefault();
    if (!docSectorId) return;
    setSavingDoc(true);
    try {
      await createEntry({ sector_id: docSectorId, question: docTitle, answer: docContent, source: docSource || null });
      setAddDocOpen(false);
      if (docSectorId === activeSectorId) {
        listEntries(docSectorId).then(setDocs);
      } else {
        setActiveSectorId(docSectorId);
      }
    } finally {
      setSavingDoc(false);
    }
  }

  async function handleDeleteDoc(id: string) {
    await deleteEntry(id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="h-full flex flex-col bg-background text-on-surface font-body-md">
      <AppHeader />

      <main className="flex-1 w-full max-w-[1200px] mx-auto p-lg flex flex-col md:flex-row gap-lg overflow-hidden h-[calc(100vh-80px)]">
        <section className="flex-1 flex flex-col bg-surface-container-lowest rounded-lg border border-outline-variant shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] overflow-hidden h-full">
          <div className="p-md border-b border-surface-variant flex items-center justify-between bg-surface-bright">
            <div className="flex items-center gap-sm">
              <div className="w-8 h-8 rounded-full bg-secondary-container text-secondary flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">smart_toy</span>
              </div>
              <div>
                <h2 className="font-small text-small font-semibold text-primary">Assistant</h2>
                <p className="font-label text-label text-on-surface-variant font-normal">Ready to answer your questions</p>
              </div>
            </div>
          </div>

          <div ref={chatHistoryRef} className="flex-1 overflow-y-auto p-md space-y-md chat-scroll bg-surface-container-low">
            {messages.map((m) => (
              <div key={m.id} className={`flex items-start gap-sm ${m.sender === "user" ? "justify-end" : ""}`}>
                {m.sender === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-secondary-container text-secondary flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="material-symbols-outlined text-[14px]">smart_toy</span>
                  </div>
                )}
                <div
                  className={
                    m.sender === "user"
                      ? "bg-surface-container-highest text-on-surface rounded-lg p-md max-w-[85%]"
                      : `bg-surface-container-lowest border-l-2 ${m.isGap ? "border-error" : "border-secondary"} p-md rounded-lg shadow-sm max-w-[85%]`
                  }
                >
                  <p className="font-body-md text-body-md">{m.text}</p>
                  {m.sources?.map((s) => (
                    <div
                      key={s.id}
                      className="mt-sm pt-sm border-t border-surface-variant flex items-center gap-xs text-outline font-label text-label"
                    >
                      <span className="material-symbols-outlined text-[14px]">description</span>
                      {s.source ?? s.question}
                    </div>
                  ))}
                  {m.isGap && (
                    <div className="mt-sm flex items-center gap-xs text-error font-label text-label">
                      <span className="material-symbols-outlined text-[14px]">warning</span> Gap Logged
                    </div>
                  )}
                </div>
              </div>
            ))}
            {asking && (
              <div className="flex items-start gap-sm">
                <div className="w-6 h-6 rounded-full bg-secondary-container text-secondary flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="material-symbols-outlined text-[14px]">smart_toy</span>
                </div>
                <div className="bg-surface-container-lowest border-l-2 border-secondary p-md rounded-lg shadow-sm max-w-[85%]">
                  <p className="font-body-md text-body-md text-on-surface-variant">…</p>
                </div>
              </div>
            )}
          </div>

          <div className="p-md border-t border-surface-variant bg-surface-bright">
            <form className="relative flex items-end gap-sm" onSubmit={handleChatSubmit}>
              <textarea
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg py-sm px-md text-body-md font-body-md text-on-surface focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 resize-none overflow-hidden min-h-[44px] max-h-[120px]"
                placeholder="Ask a question..."
                rows={1}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit(e);
                  }
                }}
              />
              <button
                className="bg-secondary text-on-secondary rounded-lg w-11 h-11 flex items-center justify-center flex-shrink-0 hover:bg-secondary/90 transition-colors disabled:opacity-60"
                type="submit"
                disabled={asking}
              >
                <span className="material-symbols-outlined">send</span>
              </button>
            </form>
            <div className="mt-xs text-center">
              <p className="font-label text-label text-outline font-normal">AI can make mistakes. Verify important information.</p>
            </div>
          </div>
        </section>

        {showKnowledgeBase && (
        <section className="w-full md:w-[400px] lg:w-[450px] flex flex-col gap-md h-full overflow-hidden">
          <div className="bg-surface-container-lowest p-md rounded-lg border border-outline-variant shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] flex-shrink-0">
            <h3 className="font-h3 text-h3 text-primary mb-xs">My Knowledge Base</h3>
            <p className="font-small text-small text-on-surface-variant font-normal">Manage documents assigned to your active sectors.</p>
          </div>

          <div className="flex-1 bg-surface-container-lowest rounded-lg border border-outline-variant shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden">
            {sectors.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-md">
                <span className="material-symbols-outlined text-4xl text-outline-variant mb-sm">note_stack</span>
                <p className="font-small text-small text-on-surface-variant">You have no assigned sectors yet.</p>
              </div>
            ) : (
              <>
                <div className="flex border-b border-surface-variant bg-surface-bright overflow-x-auto">
                  {sectors.map((sector) => (
                    <button
                      key={sector.id}
                      onClick={() => setActiveSectorId(sector.id)}
                      className={`px-md py-sm font-small text-small whitespace-nowrap ${
                        activeSectorId === sector.id
                          ? "text-secondary font-semibold border-b-2 border-secondary"
                          : "text-on-surface-variant hover:text-primary"
                      }`}
                    >
                      {sector.label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-md space-y-sm bg-surface-container-low chat-scroll">
                  {docsLoading ? (
                    <p className="font-small text-small text-on-surface-variant text-center">Loading…</p>
                  ) : docs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-md">
                      <span className="material-symbols-outlined text-4xl text-outline-variant mb-sm">note_stack</span>
                      <p className="font-small text-small text-on-surface-variant">No documents in this sector.</p>
                    </div>
                  ) : (
                    docs.map((doc) => (
                      <div key={doc.id} className="bg-surface-container-lowest p-sm rounded border border-outline-variant group">
                        <div className="flex justify-between items-start gap-sm">
                          <div className="flex-1">
                            <h4 className="font-small text-small text-primary font-semibold line-clamp-1">{doc.question}</h4>
                            <p className="font-label text-label text-on-surface-variant font-normal mt-xs line-clamp-2">{doc.answer}</p>
                            {doc.source && (
                              <div className="mt-sm flex items-center gap-xs">
                                <span className="inline-flex items-center px-xs py-0.5 rounded text-[10px] font-medium bg-surface-container-high text-on-surface-variant">
                                  <span className="material-symbols-outlined text-[12px] mr-[2px]">description</span>
                                  {doc.source}
                                </span>
                              </div>
                            )}
                          </div>
                          <button
                            className="text-outline hover:text-error transition-colors opacity-0 group-hover:opacity-100 p-xs rounded hover:bg-error-container"
                            onClick={() => handleDeleteDoc(doc.id)}
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-sm border-t border-surface-variant bg-surface-bright">
                  <button
                    className="w-full flex items-center justify-center gap-xs py-sm px-md border border-outline-variant rounded-lg font-small text-small text-primary hover:bg-surface-container-low transition-colors"
                    onClick={openAddDoc}
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span> Add New Document
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
        )}
      </main>

      <Modal open={addDocOpen} onClose={() => setAddDocOpen(false)}>
        <div className="p-md border-b border-surface-variant flex justify-between items-center">
          <h3 className="font-h3 text-h3 text-primary">Add Knowledge</h3>
          <button className="text-on-surface-variant hover:text-primary" onClick={() => setAddDocOpen(false)}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form className="p-md space-y-md" onSubmit={handleAddDoc}>
          <div>
            <label className="block font-small text-small text-primary mb-xs">Question / Title</label>
            <input
              className="w-full bg-surface border border-outline-variant rounded-md py-sm px-sm text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
              required
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="block font-small text-small text-primary mb-xs">Sector</label>
            <select
              className="w-full bg-surface border border-outline-variant rounded-md py-sm px-sm text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
              required
              value={docSectorId}
              onChange={(e) => setDocSectorId(e.target.value)}
            >
              {sectors.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-small text-small text-primary mb-xs">Answer / Content</label>
            <textarea
              className="w-full bg-surface border border-outline-variant rounded-md py-sm px-sm text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none resize-none"
              required
              rows={4}
              value={docContent}
              onChange={(e) => setDocContent(e.target.value)}
            />
          </div>
          <div>
            <label className="block font-small text-small text-primary mb-xs">Source Reference</label>
            <input
              className="w-full bg-surface border border-outline-variant rounded-md py-sm px-sm text-body-md focus:border-secondary focus:ring-1 focus:ring-secondary outline-none"
              placeholder="e.g., Doc-123 or URL"
              type="text"
              value={docSource}
              onChange={(e) => setDocSource(e.target.value)}
            />
          </div>
          <div className="pt-sm flex justify-end gap-sm">
            <button
              type="button"
              className="px-md py-sm border border-outline-variant rounded-lg font-small text-small text-on-surface-variant hover:bg-surface-container-low transition-colors"
              onClick={() => setAddDocOpen(false)}
            >
              Cancel
            </button>
            <button
              className="px-md py-sm bg-secondary text-on-secondary rounded-lg font-small text-small hover:bg-secondary/90 transition-colors disabled:opacity-60"
              type="submit"
              disabled={savingDoc || !docSectorId}
            >
              {savingDoc ? "Saving…" : "Save Document"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
