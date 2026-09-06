import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import * as chatApi from "../api/chat";
import * as knowledgeApi from "../api/knowledge";
import * as sectorsApi from "../api/sectors";
import { useAuth } from "../auth/AuthContext";
import { DashboardPage } from "../pages/DashboardPage";
import { renderWithRouter, testSectors, testUser } from "./test-utils";

vi.mock("../auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));
vi.mock("../api/chat", () => ({
  askQuestion: vi.fn(),
}));
vi.mock("../api/knowledge", () => ({
  listEntries: vi.fn(),
  createEntry: vi.fn(),
  deleteEntry: vi.fn(),
}));
vi.mock("../api/sectors", () => ({
  listSectors: vi.fn(),
}));
vi.mock("../components/AppHeader", () => ({
  AppHeader: () => <header>Header</header>,
}));
vi.mock("../components/Modal", () => ({
  Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div role="dialog">{children}</div> : null),
}));

const knowledgeEntry = {
  id: "entry-1",
  sector_id: testSectors[0].id,
  question: "Release process",
  answer: "Product review is required.",
  source: "handbook.md",
  created_by: testUser.id,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const answerResponse = {
  answer: "Releases require product review.",
  sources: [{ id: knowledgeEntry.id, question: knowledgeEntry.question, answer: knowledgeEntry.answer, source: knowledgeEntry.source }],
  is_gap: false,
  confidence: 0.91,
};

function renderDashboard(user = testUser) {
  vi.mocked(useAuth).mockReturnValue({
    user,
    loading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
  });
  return renderWithRouter(<DashboardPage />);
}

describe("DashboardPage", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(sectorsApi.listSectors).mockResolvedValue(testSectors);
    vi.mocked(knowledgeApi.listEntries).mockResolvedValue([]);
    vi.mocked(knowledgeApi.createEntry).mockResolvedValue(knowledgeEntry);
    vi.mocked(knowledgeApi.deleteEntry).mockResolvedValue(undefined);
  });

  it("shows only the regular user's assigned sectors", async () => {
    renderDashboard();

    await waitFor(() => expect(screen.getByText("Product")).toBeTruthy());
    expect(screen.queryByText("Company")).toBeNull();
    expect(sectorsApi.listSectors).not.toHaveBeenCalled();
  });

  it("shows all sectors for a super admin", async () => {
    renderDashboard({ ...testUser, role: "superAdmin", sectors: [] });

    await waitFor(() => expect(screen.getByText("Company")).toBeTruthy());
    expect(sectorsApi.listSectors).toHaveBeenCalled();
  });

  it("submits knowledge metadata and removes a document after delete", async () => {
    vi.mocked(knowledgeApi.listEntries).mockResolvedValue([knowledgeEntry]);
    renderDashboard();

    await waitFor(() => expect(screen.getByText("Release process")).toBeTruthy());
    const card = screen.getByText("Release process").closest("div.group");
    expect(card).toBeTruthy();
    fireEvent.click(within(card as HTMLElement).getByRole("button"));
    await waitFor(() => expect(screen.queryByText("Release process")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: /Add New Document/i }));
    const modalTextboxes = screen.getAllByRole("textbox");
    fireEvent.change(modalTextboxes[1], { target: { value: "New policy" } });
    fireEvent.change(modalTextboxes[2], { target: { value: "Policy details" } });
    fireEvent.change(modalTextboxes[3], { target: { value: "policy.md" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Document" }));

    await waitFor(() =>
      expect(knowledgeApi.createEntry).toHaveBeenCalledWith({
        sector_id: testSectors[0].id,
        question: "New policy",
        answer: "Policy details",
        source: "policy.md",
      }),
    );
  });

  it("renders answer sources and flags a low-confidence gap", async () => {
    vi.mocked(chatApi.askQuestion).mockResolvedValueOnce(answerResponse).mockResolvedValueOnce({
      answer: null,
      sources: [],
      is_gap: true,
      confidence: 0.2,
    });
    renderDashboard();

    const input = screen.getByPlaceholderText("Ask a question...");
    fireEvent.change(input, { target: { value: "How are releases approved?" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    await waitFor(() => expect(screen.getByText("Releases require product review.")).toBeTruthy());
    expect(screen.getByText("handbook.md")).toBeTruthy();

    fireEvent.change(input, { target: { value: "Unknown question" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    await waitFor(() => expect(screen.getByText("Gap Logged")).toBeTruthy());
  });

  it("renders URL sources as compact clickable references", async () => {
    const urlSource = "https://docs.example.com/policies/remote-work";
    vi.mocked(knowledgeApi.listEntries).mockResolvedValue([
      { ...knowledgeEntry, source: urlSource },
    ]);
    renderDashboard();

    await waitFor(() => expect(screen.getByText("Release process")).toBeTruthy());

    const link = screen.getByRole("link", { name: "Release process" });
    expect(link).toHaveAttribute("href", urlSource);
    expect(link).toHaveAttribute("target", "_blank");
  });
});
