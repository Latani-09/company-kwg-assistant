import { useEffect, useMemo, useState } from "react";
import * as adminUsersApi from "../api/adminUsers";
import * as gapsApi from "../api/gaps";
import { listSectors } from "../api/sectors";
import type { AdminUser, Gap, Sector, UserStatus } from "../api/types";
import { AppHeader } from "../components/AppHeader";
import { useToast } from "../components/Toast";

type AdminTab = "users" | "gaps";
type StatusFilter = "all" | UserStatus;

export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const { showToast } = useToast();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  function reloadUsers() {
    adminUsersApi.listUsers().then(setUsers);
  }

  function reloadGaps() {
    gapsApi.listGaps("open").then(setGaps);
  }

  useEffect(() => {
    reloadUsers();
    listSectors().then(setSectors);
    reloadGaps();
  }, []);

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (!term) return true;
      return (
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.username.toLowerCase().includes(term)
      );
    });
  }, [users, statusFilter, search]);

  async function handleAccessChange(userId: string, status: UserStatus) {
    const updated = await adminUsersApi.updateAccess(userId, status);
    setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    showToast(`Access ${status === "granted" ? "granted" : "revoked"} for ${updated.name}`);
  }

  async function handleAssign(gapId: string, sectorId: string, assignedToId: string) {
    const assignee = usersById.get(assignedToId);
    await gapsApi.assignGap(gapId, { assigned_sector_id: sectorId, assigned_to_id: assignedToId });
    setGaps((prev) => prev.filter((g) => g.id !== gapId));
    showToast(`Notified ${assignee?.name ?? "user"} by email`);
  }

  return (
    <div className="h-full flex flex-col bg-background text-on-surface font-body-md">
      <AppHeader />

      <main className="flex-1 overflow-y-auto px-lg py-xl">
        <div className="max-w-[1200px] mx-auto space-y-lg">
          <div className="flex flex-wrap items-center justify-between gap-md">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-xs flex gap-xs w-fit shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]">
              <button
                className={`px-md py-sm rounded font-small text-small transition-colors ${
                  tab === "users" ? "font-bold bg-secondary/10 text-secondary" : "text-on-surface-variant hover:bg-surface-container-low"
                }`}
                onClick={() => setTab("users")}
              >
                User Management
              </button>
              <button
                className={`px-md py-sm rounded font-small text-small transition-colors ${
                  tab === "gaps" ? "font-bold bg-secondary/10 text-secondary" : "text-on-surface-variant hover:bg-surface-container-low"
                }`}
                onClick={() => setTab("gaps")}
              >
                Knowledge Gaps
              </button>
            </div>

            {tab === "users" && (
              <div className="flex items-center gap-sm">
                <select
                  className="bg-surface-container-lowest border border-outline-variant rounded-lg px-sm py-[6px] font-small text-small focus:outline-none focus:border-secondary"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="granted">Granted</option>
                  <option value="revoked">Revoked</option>
                </select>
                <div className="relative w-full sm:w-56 md:w-64">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
                    search
                  </span>
                  <input
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-[36px] pr-sm py-[6px] font-small text-small focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all"
                    placeholder="Search..."
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {tab === "users" && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col min-h-[500px]">
              <div className="px-md py-sm border-b border-outline-variant bg-surface-container-low/50 flex justify-between items-center">
                <h2 className="font-h3 text-h3 text-primary">Signed-up Users</h2>
                <span className="font-label text-label text-on-surface-variant">Grant or revoke workspace access</span>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-low/30 sticky top-0 border-b border-outline-variant">
                    <tr>
                      <th className="py-sm px-md font-label text-label text-on-surface-variant uppercase tracking-wider">Name</th>
                      <th className="py-sm px-md font-label text-label text-on-surface-variant uppercase tracking-wider">Email</th>
                      <th className="py-sm px-md font-label text-label text-on-surface-variant uppercase tracking-wider">Position</th>
                      <th className="py-sm px-md font-label text-label text-on-surface-variant uppercase tracking-wider">Sector(s)</th>
                      <th className="py-sm px-md font-label text-label text-on-surface-variant uppercase tracking-wider text-center">
                        Status
                      </th>
                      <th className="py-sm px-md font-label text-label text-on-surface-variant uppercase tracking-wider text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50 font-small text-small">
                    {filteredUsers.map((u) => {
                      const granted = u.status === "granted";
                      const revoked = u.status === "revoked";
                      const statusLabel = granted ? "Granted" : revoked ? "Revoked" : "Pending";
                      const statusColor = granted
                        ? "text-secondary bg-secondary/10"
                        : revoked
                          ? "text-error bg-error-container/50"
                          : "text-[#564427] bg-[#fadfb8]/40";
                      return (
                        <tr key={u.id} className="hover:bg-surface-container-low/30 transition-colors">
                          <td className="py-md px-md font-medium text-primary">{u.name}</td>
                          <td className="py-md px-md text-on-surface-variant">{u.email}</td>
                          <td className="py-md px-md">{u.position}</td>
                          <td className="py-md px-md text-on-surface-variant">
                            {u.sectors.length ? (
                              <span className="bg-[#F1F5F9] text-[#64748B] px-xs py-[2px] rounded text-[12px]">
                                {u.sectors.map((s) => s.label).join(", ")}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-md px-md text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full font-label text-label ${statusColor}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="py-md px-md text-right space-x-sm">
                            {granted ? (
                              <button
                                onClick={() => handleAccessChange(u.id, "revoked")}
                                className="text-error hover:bg-error-container/20 px-sm py-xs rounded font-small text-small transition-colors"
                              >
                                Revoke
                              </button>
                            ) : (
                              <button
                                onClick={() => handleAccessChange(u.id, "granted")}
                                className="border border-outline-variant text-primary hover:bg-surface-container-low px-sm py-xs rounded font-small text-small transition-colors"
                              >
                                Grant
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "gaps" && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col min-h-[500px]">
              <div className="px-md py-sm border-b border-outline-variant bg-surface-container-low/50 flex justify-between items-center">
                <h2 className="font-h3 text-h3 text-primary">Flagged Knowledge Gaps</h2>
                <span className="bg-[#F1F5F9] text-[#64748B] font-label text-label px-sm py-xs rounded">Requires Action</span>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-low/30 sticky top-0 border-b border-outline-variant">
                    <tr>
                      <th className="py-sm px-md font-label text-label text-on-surface-variant uppercase tracking-wider w-2/5">
                        Question / Topic
                      </th>
                      <th className="py-sm px-md font-label text-label text-on-surface-variant uppercase tracking-wider">
                        Requested By
                      </th>
                      <th className="py-sm px-md font-label text-label text-on-surface-variant uppercase tracking-wider">Sector</th>
                      <th className="py-sm px-md font-label text-label text-on-surface-variant uppercase tracking-wider">Assign To</th>
                      <th className="py-sm px-md font-label text-label text-on-surface-variant uppercase tracking-wider text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/50 font-small text-small">
                    {gaps.map((gap) => (
                      <GapRow
                        key={gap.id}
                        gap={gap}
                        sectors={sectors}
                        asker={usersById.get(gap.asker_id)}
                        onAssign={handleAssign}
                        showToast={showToast}
                      />
                    ))}
                    {gaps.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-lg px-md text-center text-on-surface-variant font-small text-small">
                          No open knowledge gaps.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

interface GapRowProps {
  gap: Gap;
  sectors: Sector[];
  asker: AdminUser | undefined;
  onAssign: (gapId: string, sectorId: string, assignedToId: string) => Promise<void>;
  showToast: (message: string) => void;
}

function GapRow({ gap, sectors, asker, onAssign, showToast }: GapRowProps) {
  const [sectorId, setSectorId] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [smeOptions, setSmeOptions] = useState<AdminUser[]>([]);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!sectorId) {
      setSmeOptions([]);
      setAssignedToId("");
      return;
    }
    const sector = sectors.find((s) => s.id === sectorId);
    if (!sector) return;
    adminUsersApi.listUsers({ status: "granted", sector: sector.key }).then(setSmeOptions);
    setAssignedToId("");
  }, [sectorId, sectors]);

  async function handleAssignClick() {
    if (!sectorId || !assignedToId) {
      showToast("Select a sector and an SME before assigning.");
      return;
    }
    setAssigning(true);
    try {
      await onAssign(gap.id, sectorId, assignedToId);
    } finally {
      setAssigning(false);
    }
  }

  return (
    <tr className="hover:bg-surface-container-low/30 transition-colors">
      <td className="py-md px-md">
        <p className="font-medium text-primary">{gap.question_text}</p>
      </td>
      <td className="py-md px-md text-on-surface-variant align-top">{asker?.name ?? "—"}</td>
      <td className="py-md px-md align-top">
        <select
          className="bg-surface border border-outline-variant rounded px-sm py-xs font-small text-small focus:outline-none focus:border-secondary w-full"
          value={sectorId}
          onChange={(e) => setSectorId(e.target.value)}
        >
          <option value="">Select sector...</option>
          {sectors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </td>
      <td className="py-md px-md align-top">
        <select
          className="bg-surface border border-outline-variant rounded px-sm py-xs font-small text-small focus:outline-none focus:border-secondary w-full"
          value={assignedToId}
          onChange={(e) => setAssignedToId(e.target.value)}
          disabled={!sectorId}
        >
          <option value="">Select SME...</option>
          {smeOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </td>
      <td className="py-md px-md text-right align-top">
        <button
          className="bg-secondary text-white px-md py-xs rounded font-small text-small hover:bg-secondary/90 transition-colors disabled:opacity-60"
          onClick={handleAssignClick}
          disabled={assigning}
        >
          Assign
        </button>
      </td>
    </tr>
  );
}
