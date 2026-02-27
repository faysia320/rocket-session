/**
 * 세션 행 우클릭 컨텍스트 메뉴.
 * 태그 서브메뉴를 통해 세션에 태그를 적용/제거할 수 있다.
 */
import { useState, useCallback } from "react";
import { Tag, Settings2 } from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuCheckboxItem,
  ContextMenuSeparator,
  ContextMenuItem,
} from "@/components/ui/context-menu";
import {
  useTags,
  useAddTagsToSession,
  useRemoveTagFromSession,
} from "@/features/tags/hooks/useTags";
import { TagManagerDialog } from "@/features/tags/components/TagManagerDialog";
import type { SessionInfo } from "@/types";

interface SessionContextMenuProps {
  session: SessionInfo;
  children: React.ReactNode;
}

export function SessionContextMenu({ session, children }: SessionContextMenuProps) {
  const { data: allTags = [] } = useTags();
  const addTags = useAddTagsToSession();
  const removeTag = useRemoveTagFromSession();
  const [tagManagerOpen, setTagManagerOpen] = useState(false);

  const currentTagIds = session.tags?.map((t) => t.id) ?? [];

  const handleTagToggle = useCallback(
    (tagId: string, checked: boolean) => {
      if (checked) {
        addTags.mutate({ sessionId: session.id, tagIds: [tagId] });
      } else {
        removeTag.mutate({ sessionId: session.id, tagId });
      }
    },
    [session.id, addTags, removeTag],
  );

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuSub>
            <ContextMenuSubTrigger className="gap-2">
              <Tag className="h-3.5 w-3.5" />
              태그
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              {allTags.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  태그가 없습니다
                </div>
              ) : (
                allTags.map((tag) => (
                  <ContextMenuCheckboxItem
                    key={tag.id}
                    checked={currentTagIds.includes(tag.id)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(checked) => handleTagToggle(tag.id, !!checked)}
                    className="gap-2"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="truncate">{tag.name}</span>
                  </ContextMenuCheckboxItem>
                ))
              )}
              <ContextMenuSeparator />
              <ContextMenuItem
                className="gap-2 text-xs"
                onSelect={() => setTagManagerOpen(true)}
              >
                <Settings2 className="h-3.5 w-3.5" />
                태그 관리…
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>
      <TagManagerDialog open={tagManagerOpen} onOpenChange={setTagManagerOpen} />
    </>
  );
}
