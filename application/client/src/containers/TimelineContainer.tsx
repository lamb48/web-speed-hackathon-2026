import { InfiniteScroll } from "@web-speed-hackathon-2026/client/src/components/foundation/InfiniteScroll";
import { TimelinePage } from "@web-speed-hackathon-2026/client/src/components/timeline/TimelinePage";
import { useDocumentTitle } from "@web-speed-hackathon-2026/client/src/hooks/use_document_title";
import { useInfiniteFetch } from "@web-speed-hackathon-2026/client/src/hooks/use_infinite_fetch";
import { fetchJSON } from "@web-speed-hackathon-2026/client/src/utils/fetchers";

export const TimelineContainer = () => {
  useDocumentTitle("タイムライン - CaX");

  const {
    data: posts,
    fetchMore,
    hasMore,
  } = useInfiniteFetch<Models.Post>("/api/v1/posts", fetchJSON);

  return (
    <InfiniteScroll fetchMore={fetchMore} hasMore={hasMore} items={posts}>
      <TimelinePage timeline={posts} />
    </InfiniteScroll>
  );
};
