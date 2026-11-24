import { TypePage, typePageMetadata } from "@/features/qr-type-pages/type-page";

export const generateMetadata = () => typePageMetadata("vcard");

export default function Page() {
  return <TypePage type="vcard" />;
}
