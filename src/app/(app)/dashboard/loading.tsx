import { LoadingRegion, SkeletonBlock, SkeletonLine } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <LoadingRegion>
      <SkeletonLine className="h-8 w-40" />
      <SkeletonBlock className="mt-6 h-20 w-full" />
      <SkeletonLine className="mt-10 h-6 w-28" />
      <div className="mt-4 flex flex-col gap-5">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <SkeletonLine className="w-48" />
            <SkeletonLine className="h-3 w-32" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}
