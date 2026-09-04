import MutationsPage, { makeMutationsPrefetch } from "@/components/MutationsPage";
export const prefetch = makeMutationsPrefetch("other");
export default function OtherMutations() {
  return <MutationsPage type="other" />;
}
