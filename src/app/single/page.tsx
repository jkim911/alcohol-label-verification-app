import { ReviewSingle } from "@/components/ReviewSingle";
import { SAMPLES } from "@/lib/samples";

export const metadata = { title: "Review one label · Alcohol Verification App" };

export default function SinglePage() {
  return <ReviewSingle samples={SAMPLES} />;
}
