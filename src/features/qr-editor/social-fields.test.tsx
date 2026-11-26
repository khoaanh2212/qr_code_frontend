// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { en } from "@/i18n/messages/en";
import { SOCIAL_NETWORKS } from "@/lib/qr/social";
import type { QrData, QrType } from "@/lib/qr/types";
import { ContentFields } from "./fields";

const t = en.generator;
const social: QrType = {
  type: "social",
  fields: [
    { name: "network", required: true, options: [...SOCIAL_NETWORKS] },
    { name: "username", required: true },
    { name: "text", required: false, multiline: true },
  ],
};

function fields(data: QrData, errors: Record<string, string> = {}) {
  return render(<ContentFields t={t} qrType={social} data={data} errors={errors} onChange={() => {}} onBlur={() => {}} />);
}

afterEach(cleanup);

describe("the generator's social fields", () => {
  it("names the networks and shows each one's username rule and link", () => {
    fields({ network: "tiktok", username: "@proof_qr" });
    expect(screen.getByRole("option", { name: "TikTok" })).toBeTruthy();
    expect(screen.getByLabelText(/Username/)).toBeTruthy();
    expect(screen.getByText(t.social.usernameHelp.tiktok)).toBeTruthy();
    expect(screen.getByText("https://www.tiktok.com/@proof_qr")).toBeTruthy();
    // The opening message is WhatsApp's only.
    expect(screen.queryByLabelText(t.fields.social.text.label)).toBeNull();
  });

  it("asks WhatsApp for a phone number and offers the opening message", () => {
    fields({ network: "whatsapp", username: "" });
    const phone = screen.getByLabelText(new RegExp(t.social.phone));
    expect(phone.getAttribute("type")).toBe("tel");
    expect(screen.getByLabelText(t.fields.social.text.label)).toBeTruthy();
    expect(screen.queryByText(t.social.leadsTo, { exact: false })).toBeNull(); // nothing valid to show yet
  });

  it("shows the error instead of the link when the username is refused", () => {
    fields({ network: "instagram", username: "proof-qr" }, { username: t.validation.socialUsername });
    expect(screen.getByText(t.validation.socialUsername)).toBeTruthy();
    expect(screen.queryByText(t.social.leadsTo, { exact: false })).toBeNull();
  });
});
