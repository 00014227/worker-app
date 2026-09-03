import { useEffect, useState } from 'react';
import { useInView } from 'react-intersection-observer';

export function useInfiniteScroll<T>(items: T[], resetKey: string, step = 30) {
  const [visibleCount, setVisibleCount] = useState(step);
  const visible = items.slice(0, visibleCount);

  const { ref } = useInView({
    threshold: 0,
    rootMargin: '200px',
    onChange: (inView) => {
      if (inView && visibleCount < items.length) {
        setVisibleCount((prev) => prev + step);
      }
    },
  });

  useEffect(() => {
    setVisibleCount(step);
  }, [resetKey, step]);

  return {
    visible: visible,
    ref,
    hasMore: visibleCount < items.length,
  };
}
