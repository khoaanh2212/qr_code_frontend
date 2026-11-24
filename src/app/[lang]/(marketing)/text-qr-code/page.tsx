import { TypePage, typePageMetadata } from "@/features/qr-type-pages/type-page";

export const generateMetadata = () => typePageMetadata("text");

export default function Page() {
  return <TypePage type="text" />;
}
