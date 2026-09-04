import MutationsPage, { makeMutationsPrefetch } from "@/components/MutationsPage";
export const prefetch = makeMutationsPrefetch("paper");
export default function PaperMutations() {
  return <MutationsPage type="paper" />;
}
