import { format } from "./config";

/**
 * Plural forms of one message. `other` is required; languages without a singular form (Vietnamese)
 * only give `other`. Keys follow Intl.PluralRules categories.
 */
export type PluralForms = Partial<Record<Exclude<Intl.LDMLPluralRule, "other">, string>> & { other: string };

const rules = new Map<string, Intl.PluralRules>();

/** The form of `forms` for `count` in `locale`, with `{count}` and any other placeholders filled. */
export function plural(locale: string, forms: PluralForms, count: number, values: Record<string, string | number> = {}): string {
  let pr = rules.get(locale);
  if (!pr) {
    pr = new Intl.PluralRules(locale);
    rules.set(locale, pr);
  }
  const category = pr.select(count);
  const template = (category === "other" ? undefined : forms[category]) ?? forms.other;
  return format(template, { ...values, count: new Intl.NumberFormat(locale).format(count) });
}
