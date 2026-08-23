import { LoadingRegion, SkeletonBlock, SkeletonLine } from '@/components/ui/Skeleton';

export default function UploadLoading() {
  return (
    <LoadingRegion>
      <SkeletonLine className="h-8 w-44" />
      <SkeletonLine className="mt-3 w-64" />
      <SkeletonBlock className="mt-8 h-32 w-full" />
      <SkeletonBlock className="mt-5 h-12 w-full" />
    </LoadingRegion>
  );
}
