import { LoadingRegion, SkeletonBlock, SkeletonLine } from '@/components/ui/Skeleton';

export default function StudySetLoading() {
  return (
    <LoadingRegion>
      <SkeletonLine className="h-3 w-24" />
      <SkeletonLine className="mt-3 h-8 w-56" />
      <SkeletonLine className="mt-2 h-3 w-32" />
      <SkeletonBlock className="mt-6 h-10 w-full" />
      <div className="mt-8 flex flex-col gap-3">
        <SkeletonLine className="w-full" />
        <SkeletonLine className="w-full" />
        <SkeletonLine className="w-4/5" />
      </div>
    </LoadingRegion>
  );
}
