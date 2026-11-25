// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/messages/en";
import type { DynamicCode, Folder } from "@/lib/api/types";
import { MoveDialog, type PendingMove } from "./move-dialog";

const t = en.codes;
const f = t.folders;
const folder = (id: string, name: string): Folder => ({ id, name, code_count: 0, created_at: "", updated_at: "" });
const a = folder("fa", "Alpha");
const b = folder("fb", "Beta");
const code = { id: "c1", name: "Menu", folder_id: null } as DynamicCode;

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);

describe("MoveDialog", () => {
  it("does not send a folder that vanished from the list after it was picked", async () => {
    const onConfirm = vi.fn();
    const pending: PendingMove = { codes: [code], bulk: true };
    const ui = (folders: Folder[]) => <MoveDialog t={t} locale="en" pending={pending} folders={folders} onConfirm={onConfirm} onCancel={() => {}} />;
    const { rerender } = render(ui([a, b]));
    const select = () => within(screen.getByRole("dialog")).getByRole("combobox", { name: f.moveTo }) as HTMLSelectElement;
    fireEvent.change(select(), { target: { value: "fb" } });
    expect(select().value).toBe("fb");
    rerender(ui([a])); // Beta was deleted in the meantime
    expect(select().value).toBe(""); // what is shown is what would be sent
    await act(async () => void fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: f.moveConfirm })));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(within(screen.getByRole("dialog")).getByRole("alert").textContent).toBe(f.chooseFirst);
  });
});
