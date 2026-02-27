import type { FileChange } from "@/types";
import type { MergedFileChange, FileTreeNode } from "./types";

/** FileChange 배열을 파일 경로 기준으로 병합 (마지막 변경 기준 정렬) */
export function mergeFileChanges(changes: FileChange[]): MergedFileChange[] {
  const map = new Map<string, MergedFileChange>();

  for (const change of changes) {
    const existing = map.get(change.file);
    if (existing) {
      existing.count += 1;
      if (!existing.tools.includes(change.tool)) {
        existing.tools.push(change.tool);
      }
      existing.lastTimestamp = change.timestamp;
      existing.latest = change;
    } else {
      map.set(change.file, {
        file: change.file,
        tools: [change.tool],
        count: 1,
        lastTimestamp: change.timestamp,
        latest: change,
      });
    }
  }

  // 마지막 변경 시간 역순 (최근 변경이 위로)
  return Array.from(map.values()).reverse();
}

/** MergedFileChange 배열로 파일 트리 구조 생성 */
export function buildFileTree(merged: MergedFileChange[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  // 경로를 세그먼트로 분할하고 트리에 삽입
  for (const item of merged) {
    const parts = item.file.split(/[/\\]/);
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join("/");

      if (isLast) {
        // 파일 리프 노드
        currentLevel.push({
          name: part,
          path: item.file,
          isDirectory: false,
          children: [],
          fileChange: item,
          fileCount: 1,
        });
      } else {
        // 디렉토리 노드 찾기 또는 생성
        let dirNode = currentLevel.find((n) => n.isDirectory && n.path === fullPath);
        if (!dirNode) {
          dirNode = {
            name: part,
            path: fullPath,
            isDirectory: true,
            children: [],
            fileCount: 0,
          };
          currentLevel.push(dirNode);
        }
        currentLevel = dirNode.children;
      }
    }
  }

  // 단일 자식 디렉토리 체인 압축 (VS Code compact folders 패턴)
  function compactNode(node: FileTreeNode): FileTreeNode {
    if (!node.isDirectory) return node;
    node.children = node.children.map(compactNode);

    // 단일 자식이 디렉토리인 경우 이름을 합침
    while (node.children.length === 1 && node.children[0].isDirectory) {
      const child = node.children[0];
      node.name = node.name + "/" + child.name;
      node.path = child.path;
      node.children = child.children;
    }

    return node;
  }

  // 하위 파일 수 집계
  function countFiles(node: FileTreeNode): number {
    if (!node.isDirectory) return 1;
    let count = 0;
    for (const child of node.children) {
      count += countFiles(child);
    }
    node.fileCount = count;
    return count;
  }

  // 디렉토리 우선 + 알파벳순 정렬
  function sortNodes(nodes: FileTreeNode[]): FileTreeNode[] {
    return nodes
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((node) => {
        if (node.isDirectory) {
          node.children = sortNodes(node.children);
        }
        return node;
      });
  }

  const compacted = root.map(compactNode);
  compacted.forEach(countFiles);
  return sortNodes(compacted);
}

/** 절대 경로이면 마지막 3세그먼트로 축약, 상대 경로는 그대로 표시 */
export function shortenFilePath(filePath: string): string {
  // Windows/Unix 절대 경로 감지
  const isAbsolute = /^[A-Z]:[/\\]/i.test(filePath) || filePath.startsWith("/");
  if (!isAbsolute) return filePath;
  const parts = filePath.split(/[/\\]/);
  if (parts.length <= 3) return filePath;
  return ".../" + parts.slice(-3).join("/");
}
