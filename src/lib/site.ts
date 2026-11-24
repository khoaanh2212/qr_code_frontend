/** Brand name (PRODUCT.md "Brand Commitments"): the same in every language. */
export const SITE_NAME = "ProofQR";

/**
 * "Devices | ProofQR", stated in full. Nested title templates are easy to get wrong
 * (a segment's own title skips its template, a plain parent title stops a grandparent's), so
 * app pages set absolute titles with this.
 */
export function pageTitle(title: string): { absolute: string } {
  return { absolute: `${title} | ${SITE_NAME}` };
}
