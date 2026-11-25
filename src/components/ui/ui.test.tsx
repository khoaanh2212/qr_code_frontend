// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Checkbox } from "./checkbox";
import { ConfirmDialog } from "./confirm-dialog";
import { CopyButton } from "./copy-button";
import { EmptyState } from "./empty-state";
import { IconButton } from "./icon-button";
import { Menu, MenuItem } from "./menu";
import { SegmentedControl } from "./segmented-control";
import { SearchField } from "./search-field";
import { Drawer } from "./drawer";
import { Select } from "./select";

beforeAll(() => {
  // jsdom has <dialog> but not its modal API.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("IconButton", () => {
  it("is named by its label and keeps the icon out of the accessibility tree", () => {
    render(<IconButton label="Delete code" icon={Trash2} />);
    const button = screen.getByRole("button", { name: "Delete code" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("Checkbox", () => {
  it("shows the mixed state for a partial selection", () => {
    const { rerender } = render(<Checkbox label="Select all" indeterminate checked={false} onChange={() => {}} />);
    const box = screen.getByRole("checkbox", { name: "Select all" }) as HTMLInputElement;
    expect(box.indeterminate).toBe(true);
    rerender(<Checkbox label="Select all" checked onChange={() => {}} />);
    expect(box.indeterminate).toBe(false);
    expect(box.checked).toBe(true);
  });
});

describe("Menu", () => {
  function Example({ onPause = vi.fn() }: { onPause?: () => void }) {
    return (
      <Menu label="Actions for Menu">
        <MenuItem onSelect={onPause}>Pause</MenuItem>
        <MenuItem onSelect={() => {}} disabled>
          Locked
        </MenuItem>
        <MenuItem onSelect={() => {}} tone="danger">
          Delete
        </MenuItem>
      </Menu>
    );
  }

  it("opens on click, focuses the first item and moves with the arrow keys, disabled items included", () => {
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Actions for Menu" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const items = screen.getAllByRole("menuitem");
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[2]);
    fireEvent.keyDown(items[2]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0]!, { key: "End" });
    expect(document.activeElement).toBe(items[2]);
    fireEvent.keyDown(items[2]!, { key: "Home" });
    expect(document.activeElement).toBe(items[0]);
  });

  it("closes on Escape and gives focus back to its button", () => {
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Actions for Menu" });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getAllByRole("menuitem")[0]!, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("opens from the keyboard on ArrowUp at the last item", () => {
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Actions for Menu" });
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    expect(document.activeElement).toBe(screen.getAllByRole("menuitem")[2]);
  });

  it("runs the item's action, then closes", () => {
    const onPause = vi.fn();
    render(<Example onPause={onPause} />);
    fireEvent.click(screen.getByRole("button", { name: "Actions for Menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Pause" }));
    expect(onPause).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes on Tab with focus back on its button, so Tab moves on from there", () => {
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Actions for Menu" });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getAllByRole("menuitem")[0]!, { key: "Tab" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("ignores a disabled item and closes on a click outside", () => {
    render(<Example />);
    fireEvent.click(screen.getByRole("button", { name: "Actions for Menu" }));
    const locked = screen.getByRole("menuitem", { name: "Locked" });
    expect(locked.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(locked);
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});

describe("SegmentedControl", () => {
  it("is a radio group named by its legend, options named even when only icons show", () => {
    function Example() {
      const [value, setValue] = useState<"list" | "grid">("list");
      return (
        <SegmentedControl
          legend="Layout"
          value={value}
          onChange={setValue}
          hideLabels
          options={[
            { value: "list", label: "List", icon: Trash2 },
            { value: "grid", label: "Grid", icon: Trash2 },
          ]}
        />
      );
    }
    render(<Example />);
    expect(screen.getByRole("group", { name: "Layout" })).toBeTruthy();
    const grid = screen.getByRole("radio", { name: "Grid" }) as HTMLInputElement;
    fireEvent.click(grid);
    expect(grid.checked).toBe(true);
  });
});

describe("SearchField and Select", () => {
  it("label their controls", () => {
    const onSearch = vi.fn();
    const onSort = vi.fn();
    render(
      <>
        <SearchField label="Search codes" value="" onValueChange={onSearch} />
        <Select
          label="Sort by"
          value="newest"
          onChange={onSort}
          options={[
            { value: "newest", label: "Newest first" },
            { value: "name", label: "Name" },
          ]}
        />
      </>,
    );
    fireEvent.change(screen.getByRole("searchbox", { name: "Search codes" }), { target: { value: "menu" } });
    expect(onSearch).toHaveBeenCalledWith("menu");
    fireEvent.change(screen.getByRole("combobox", { name: "Sort by" }), { target: { value: "name" } });
    expect(onSort).toHaveBeenCalledWith("name");
  });

  it("leaves the chevron to the global select style, so it is never drawn twice", () => {
    const { container } = render(<Select label="Sort by" value="a" onChange={() => {}} options={[{ value: "a", label: "A" }]} />);
    expect(container.querySelector("svg")).toBeNull();
  });
});

describe("EmptyState", () => {
  it("renders its title as a heading, its body and its action", () => {
    render(
      <EmptyState icon={Trash2} title="Nothing here" action={<button type="button">Create</button>}>
        Start with one.
      </EmptyState>,
    );
    expect(screen.getByRole("heading", { name: "Nothing here" })).toBeTruthy();
    expect(screen.getByText("Start with one.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
  });
});

describe("ConfirmDialog", () => {
  it("opens as a modal dialog, confirms, and cancels with its button", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(
      <ConfirmDialog open={false} title="Delete?" confirmLabel="Delete" cancelLabel="Cancel" onConfirm={onConfirm} onCancel={onCancel}>
        Gone for good.
      </ConfirmDialog>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(
      <ConfirmDialog open title="Delete?" confirmLabel="Delete" cancelLabel="Cancel" onConfirm={onConfirm} onCancel={onCancel}>
        Gone for good.
      </ConfirmDialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Delete?" });
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    // The safe choice has focus first.
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("follows a close made by the browser itself", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="Delete?" confirmLabel="Delete" cancelLabel="Cancel" onConfirm={() => {}} onCancel={onCancel}>
        Gone.
      </ConfirmDialog>,
    );
    fireEvent(screen.getByRole("dialog"), new Event("close"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("treats Escape (the dialog's cancel event) as cancel, unless busy", () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <ConfirmDialog open title="Delete?" confirmLabel="Delete" cancelLabel="Cancel" onConfirm={() => {}} onCancel={onCancel}>
        Gone.
      </ConfirmDialog>,
    );
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onCancel).toHaveBeenCalledOnce();
    rerender(
      <ConfirmDialog open busy title="Delete?" confirmLabel="Delete" cancelLabel="Cancel" onConfirm={() => {}} onCancel={onCancel}>
        Gone.
      </ConfirmDialog>,
    );
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe("CopyButton", () => {
  it("copies the value and announces it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<CopyButton value="https://qr.example/Ab" label="Copy short link" copiedLabel="Copied." failedLabel="Copy failed." />);
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: "Copy short link" })));
    expect(writeText).toHaveBeenCalledWith("https://qr.example/Ab");
    expect(screen.getByRole("status").textContent).toBe("Copied.");
  });

  it("says so when the clipboard refuses", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    render(<CopyButton value="x" label="Copy short link" copiedLabel="Copied." failedLabel="Copy failed." />);
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: "Copy short link" })));
    expect(screen.getByRole("status").textContent).toBe("Copy failed.");
  });
});

describe("Drawer", () => {
  function Example({ onClose = vi.fn() }: { onClose?: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Filters</button>
        <Drawer
          open={open}
          title="Filters and folders"
          closeLabel="Close"
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        >
          <button>All codes</button>
        </Drawer>
      </>
    );
  }

  it("renders its content only while open, named by its title, and closes from its button, Escape and the backdrop", () => {
    const onClose = vi.fn();
    render(<Example onClose={onClose} />);
    expect(screen.queryByRole("button", { name: "All codes" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("dialog", { name: "Filters and folders" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "All codes" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true })); // Escape
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("button", { name: "All codes" })); // inside: stays open
    expect(screen.getByRole("dialog")).toBeTruthy();
    // A drag that begins in the panel and ends on the backdrop is not a click outside.
    fireEvent.pointerDown(screen.getByRole("button", { name: "All codes" }));
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(onClose).toHaveBeenCalledTimes(2);
    // Pressed and released on the dialog itself: the backdrop.
    fireEvent.pointerDown(screen.getByRole("dialog"));
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe("Select", () => {
  const options = [
    { value: "", label: "Not set" },
    { value: "poster", label: "Poster", group: "Print" },
    { value: "flyer", label: "Flyer", group: "Print" },
    { value: "website", label: "Website", group: "Digital" },
    { value: "other", label: "Other" },
  ] as const;

  it("puts grouped options under their group and leaves the others outside, in order", () => {
    const onChange = vi.fn();
    render(<Select label="Medium" value="" options={options} onChange={onChange} />);
    const select = screen.getByRole("combobox", { name: "Medium" }) as HTMLSelectElement;
    expect([...select.children].map((el) => (el instanceof HTMLOptGroupElement ? `[${el.label}]` : el.textContent))).toEqual([
      "Not set",
      "[Print]",
      "[Digital]",
      "Other",
    ]);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Not set", "Poster", "Flyer", "Website", "Other"]);
    expect([...select.querySelectorAll("optgroup")].map((g) => g.children.length)).toEqual([2, 1]);
    fireEvent.change(select, { target: { value: "website" } });
    expect(onChange).toHaveBeenCalledWith("website");
  });

  it("stays a flat list without groups, and stacks the label above when asked", () => {
    const flat = options.map(({ value, label }) => ({ value, label }));
    const { container } = render(<Select label="Medium" stacked value="poster" options={flat} onChange={() => {}} />);
    expect(container.querySelector("optgroup")).toBeNull();
    expect((screen.getByRole("combobox", { name: "Medium" }) as HTMLSelectElement).value).toBe("poster");
    expect(container.firstElementChild?.className).toContain("flex-col");
    cleanup();
    // The default keeps the label beside the select, as every toolbar has it.
    const beside = render(<Select label="Medium" value="poster" options={flat} onChange={() => {}} />);
    expect(beside.container.firstElementChild?.className).not.toContain("flex-col");
  });

  it("keeps two runs of the same group apart", () => {
    const split = [
      { value: "a", label: "A", group: "Print" },
      { value: "b", label: "B" },
      { value: "c", label: "C", group: "Print" },
    ] as const;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Select label="Medium" value="a" options={split} onChange={() => {}} />);
    expect(document.querySelectorAll("optgroup")).toHaveLength(2);
    expect(error).not.toHaveBeenCalled(); // no duplicate React keys
  });
});
