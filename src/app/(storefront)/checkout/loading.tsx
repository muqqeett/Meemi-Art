import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown while the checkout route resolves the session and the server-priced
 * cart. It holds the real page's shape — a title, two panels and a summary — so
 * nothing jumps when the form arrives. Decorative only, so it is hidden from
 * assistive technology.
 */
export default function CheckoutLoading() {
  return (
    <div data-fill aria-hidden className="flex min-h-full flex-col bg-pl-page">
      <div className="border-b border-pl-line bg-pl-surface">
        <div className="mx-auto flex h-[60px] w-full max-w-[1120px] items-center justify-between px-4 sm:px-8">
          <Skeleton className="h-4 w-28 rounded-full" />
          <Skeleton className="h-4 w-32 rounded-full" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1120px] px-4 pt-8 pb-16 sm:px-8 lg:pt-12">
        <Skeleton className="h-11 w-56 rounded-[12px] sm:h-14" />
        <Skeleton className="mt-4 h-5 w-full max-w-[420px] rounded-full" />

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
          <div className="space-y-6">
            <Skeleton className="h-[330px] rounded-[20px]" />
            <Skeleton className="h-[250px] rounded-[20px]" />
          </div>
          <Skeleton className="h-[460px] rounded-[20px]" />
        </div>
      </div>
    </div>
  );
}
