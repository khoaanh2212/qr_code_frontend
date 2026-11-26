import { describe, expect, it } from "vitest";
import { buildRenderRequest } from "./render-request";
import { DEFAULT_DESIGN } from "./types";
import { downloadName, validateFields } from "./validate";
import { parseSocialUrl, SOCIAL_NETWORKS, socialProblem, socialUrl, type SocialLink } from "./social";

const link = (network: SocialLink["network"], username: string, text = ""): SocialLink => ({ network, username, text });

describe("socialUrl (the API's links)", () => {
  it("builds each network's profile link", () => {
    expect(socialUrl(link("instagram", "@proof.qr"))).toBe("https://www.instagram.com/proof.qr/");
    expect(socialUrl(link("facebook", "proofqr.page"))).toBe("https://www.facebook.com/proofqr.page");
    expect(socialUrl(link("tiktok", "proof_qr"))).toBe("https://www.tiktok.com/@proof_qr");
    expect(socialUrl(link("youtube", "proof-qr"))).toBe("https://www.youtube.com/@proof-qr");
    expect(socialUrl(link("whatsapp", "+84 (90) 123-4567"))).toBe("https://wa.me/84901234567");
  });

  it("escapes a WhatsApp message like Go's QueryEscape, with %20 for spaces", () => {
    expect(socialUrl(link("whatsapp", "84901234567", "  Hi! 1+1 (ok)?  "))).toBe(
      "https://wa.me/84901234567?text=Hi%21%201%2B1%20%28ok%29%3F",
    );
    expect(socialUrl(link("whatsapp", "84901234567", "Xin chào"))).toBe("https://wa.me/84901234567?text=Xin%20ch%C3%A0o");
  });

  it("lists the networks in the API's order", () => {
    expect(SOCIAL_NETWORKS).toEqual(["instagram", "facebook", "tiktok", "youtube", "whatsapp"]);
  });
});

describe("socialProblem (the API's rules)", () => {
  it("accepts valid usernames", () => {
    expect(socialProblem(link("instagram", "a"))).toBeNull();
    expect(socialProblem(link("facebook", "12345"))).toBeNull();
    expect(socialProblem(link("whatsapp", "+1 555 0100", "Hello\nthere"))).toBeNull();
  });

  it("refuses an empty username or one outside the network's alphabet and length", () => {
    expect(socialProblem(link("instagram", " @ "))).toBe("usernameRequired");
    expect(socialProblem(link("instagram", "a".repeat(31)))).toBe("username");
    expect(socialProblem(link("instagram", "proof-qr"))).toBe("username"); // no dashes on Instagram
    expect(socialProblem(link("facebook", "abcd"))).toBe("username");
    expect(socialProblem(link("tiktok", "a"))).toBe("username");
    expect(socialProblem(link("youtube", "ab"))).toBe("username");
    expect(socialProblem(link("whatsapp", "123456"))).toBe("username");
    expect(socialProblem(link("instagram", "a/b"))).toBe("username");
    expect(socialProblem(link("instagram", "a?b"))).toBe("username");
  });

  it("refuses a handle made only of dots (a path step to the network's home page)", () => {
    expect(socialProblem(link("instagram", ".."))).toBe("username");
    expect(socialProblem(link("youtube", "._-"))).toBe("username");
  });

  it("checks the WhatsApp message: only for WhatsApp, 500 characters, no control or bidi characters", () => {
    expect(socialProblem(link("instagram", "proofqr", "hi"))).toBe("textNotAllowed");
    expect(socialProblem(link("instagram", "proofqr", "   "))).toBeNull(); // blank means none
    expect(socialProblem(link("whatsapp", "84901234567", "x".repeat(501)))).toBe("text");
    expect(socialProblem(link("whatsapp", "84901234567", "😀".repeat(500)))).toBe("textLong"); // fine in runes, too long encoded
    expect(socialProblem(link("whatsapp", "84901234567", "a\u0007b"))).toBe("text");
    expect(socialProblem(link("whatsapp", "84901234567", "a‮b"))).toBe("text");
    expect(socialProblem(link("whatsapp", "84901234567", "👩‍💻"))).toBeNull(); // joiners stay
  });
});

describe("parseSocialUrl (recognizing a preset link on the edit page)", () => {
  it("reads back every link socialUrl builds", () => {
    const cases: SocialLink[] = [
      link("instagram", "proof.qr"),
      link("facebook", "proofqr.page"),
      link("tiktok", "proof_qr"),
      link("youtube", "proof-qr"),
      link("whatsapp", "84901234567"),
      link("whatsapp", "84901234567", "Xin chào! 1+1 (ok)?\nBye"),
    ];
    for (const c of cases) expect(parseSocialUrl(socialUrl(c))).toEqual(c);
  });

  it("leaves other links alone", () => {
    for (const url of [
      "https://example.com/",
      "https://www.instagram.com/proof.qr", // no trailing slash: not our shape
      "https://instagram.com/proof.qr/",
      "https://www.instagram.com/p/abc/",
      "https://www.tiktok.com/@proof_qr/video/1",
      "https://www.youtube.com/@proof-qr?x=1",
      "https://wa.me/84901234567?text=hi&x=1",
      "https://wa.me/abc",
      "http://www.facebook.com/proofqr.page",
      "https://www.facebook.com/abc", // too short for Facebook's rule
      "https://www.instagram.com/../",
      "not a url",
    ]) {
      expect(parseSocialUrl(url)).toBeNull();
    }
  });
});

describe("the static social type in the generator", () => {
  const social = {
    type: "social",
    fields: [
      { name: "network", required: true, options: [...SOCIAL_NETWORKS] },
      { name: "username", required: true },
      { name: "text", required: false, multiline: true },
    ],
  };

  it("never sends a message for a network other than WhatsApp", () => {
    const r = buildRenderRequest({
      type: "social",
      data: { network: "instagram", username: "proofqr", text: "left from WhatsApp" },
      design: DEFAULT_DESIGN,
      format: "png",
      size: 512,
    });
    if (r.method !== "GET") throw new Error("expected GET");
    const q = new URL(r.path, "https://api.test").searchParams;
    expect(q.get("username")).toBe("proofqr");
    expect(q.has("text")).toBe(false);
  });

  it("says which field breaks the network's rules", () => {
    expect(validateFields(social, { network: "instagram", username: "proof-qr" })).toEqual({ username: "socialUsername" });
    expect(validateFields(social, { network: "whatsapp", username: "84901234567", text: "a‮b" })).toEqual({ text: "socialText" });
    expect(validateFields(social, { network: "instagram", username: "proofqr", text: "ignored" })).toEqual({});
    expect(validateFields(social, { network: "whatsapp", username: "+84 90 123 4567" })).toEqual({});
  });

  it("names the download after the network and the profile", () => {
    expect(downloadName("social", { network: "tiktok", username: "@Proof_QR" })).toBe("qr-tiktok-proof-qr");
    expect(downloadName("social", { network: "whatsapp", username: "" })).toBe("qr-code-social");
  });
});

describe("review follow-ups", () => {
  it("renders a WhatsApp code with POST: the number and message stay out of URLs and logs", () => {
    const r = buildRenderRequest({
      type: "social",
      data: { network: "whatsapp", username: "84901234567", text: "My order 1234" },
      design: DEFAULT_DESIGN,
      format: "png",
      size: 512,
    });
    expect(r.method).toBe("POST");
    const insta = buildRenderRequest({ type: "social", data: { network: "instagram", username: "proofqr" }, design: DEFAULT_DESIGN, format: "png", size: 512 });
    expect(insta.method).toBe("GET"); // a public profile stays cacheable
  });

  it("refuses a message with a lone surrogate instead of throwing", () => {
    expect(socialProblem(link("whatsapp", "84901234567", "cut emoji \uD83D"))).toBe("text");
  });
});
