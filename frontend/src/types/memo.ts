export interface MemoBlockInfo {
  id: string;
  content: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMemoBlockRequest {
  content?: string;
  after_block_id?: string | null;
}

export interface UpdateMemoBlockRequest {
  content: string;
}

export interface ReorderMemoBlocksRequest {
  block_ids: string[];
}
