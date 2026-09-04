import MutationsPage, { makeMutationsPrefetch } from "@/components/MutationsPage";
export const prefetch = makeMutationsPrefetch("ink");
export default function InkMutations() {
  return <MutationsPage type="ink" />;
}
