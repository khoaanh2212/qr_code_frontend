import { TypePage, typePageMetadata } from "@/features/qr-type-pages/type-page";

export const generateMetadata = () => typePageMetadata("email");

export default function Page() {
  return <TypePage type="email" />;
}
