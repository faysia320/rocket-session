import { useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { filesystemApi } from '@/lib/api/filesystem.api';

export function useDirectoryBrowser(initialPath: string = '~') {
  const [currentPath, setCurrentPath] = useState(initialPath);

  const { data, isLoading } = useQuery({
    queryKey: ['directory-list', currentPath],
    queryFn: () => filesystemApi.listDirectory(currentPath),
    retry: false,
    staleTime: 10_000,
  });

  const navigateTo = useCallback((path: string) => {
    setCurrentPath(path);
  }, []);

  const goUp = useCallback(() => {
    if (data?.parent) {
      setCurrentPath(data.parent);
    }
  }, [data?.parent]);

  return {
    currentPath,
    entries: data?.entries ?? [],
    parent: data?.parent ?? null,
    isLoading,
    navigateTo,
    goUp,
    setCurrentPath,
  };
}
