import type { AuthMessages } from "@/features/auth/form-rules";
import { format } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { ApiError } from "@/lib/api";
import { codeFailure } from "../errors";
import { CAMPAIGN_LIMITS, type CampaignDraft, type CampaignField, type CampaignProblem } from "./rules";

type T = Messages["codes"];

/** The text of a problem of the form; numbers are written as the reader's locale writes them. */
export function campaignProblem(problem: CampaignProblem, t: T, locale: string): string {
  const e = t.campaign.errors;
  switch (problem) {
    case "endBeforeStart":
      return e.endBeforeStart;
    case "dateRange":
      return e.dateRange;
    case "printRun": {
      const n = new Intl.NumberFormat(locale);
      return format(e.printRun, { min: n.format(CAMPAIGN_LIMITS.minPrintRun), max: n.format(CAMPAIGN_LIMITS.maxPrintRun) });
    }
    case "otherRequired":
      return e.otherRequired;
    case "otherInvalid":
      return format(e.otherInvalid, { max: CAMPAIGN_LIMITS.labelMax });
  }
}

/**
 * What to show for a failed campaign save: a field message for the API's `campaign.<field>`
 * refusals (it applies the same rules as the form, so these are rare), otherwise what any code
 * edit shows.
 */
export function campaignFailure(
  err: unknown,
  draft: CampaignDraft,
  t: T,
  auth: AuthMessages,
  locale: string,
): { field?: CampaignField; message: string } {
  if (err instanceof ApiError && err.code === "validation_error") {
    switch (err.field) {
      case "campaign.start_date":
        return { field: "start_date", message: campaignProblem("dateRange", t, locale) };
      case "campaign.end_date": {
        const reversed = Boolean(draft.start && draft.end && draft.end < draft.start);
        return { field: "end_date", message: campaignProblem(reversed ? "endBeforeStart" : "dateRange", t, locale) };
      }
      case "campaign.print_run":
        return { field: "print_run", message: campaignProblem("printRun", t, locale) };
      case "campaign.medium_other":
        return { field: "medium_other", message: campaignProblem(draft.other.trim() ? "otherInvalid" : "otherRequired", t, locale) };
    }
  }
  // A field of another form (the name, the destination) has no input here: a form alert then.
  return { message: codeFailure(err, t, auth).message };
}
