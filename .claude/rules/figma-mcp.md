# Figma MCP 사용 규칙

## 필수: 점진적 조회 (Progressive Fetching)

Figma MCP(`get_figma_data`)는 대형 파일에서 토큰 제한을 초과할 수 있다.
**반드시 아래 3단계 접근법을 따를 것.**

### 1단계: 구조 파악 (depth 제한)

```
get_figma_data(fileKey="...", depth=1)
```

- 전체 파일의 최상위 구조만 조회
- 페이지/프레임 이름과 nodeId를 파악

### 2단계: 특정 노드만 조회 (nodeId 지정)

```
get_figma_data(fileKey="...", nodeId="1234:5678")
```

- 1단계에서 파악한 nodeId로 필요한 프레임만 조회
- 여전히 크면 `depth=2` 등으로 추가 제한

### 3단계: 시각적 레퍼런스 (이미지 다운로드)

```
download_figma_images(fileKey="...", nodes=[...], localPath="...")
```

- 구조 데이터 대신 PNG/SVG로 다운로드
- 토큰 제한과 무관

## 토큰 초과 시 Fallback 전략

`nodeId`를 지정해도 초과하는 경우, 아래 순서로 시도:

1. **nodeId + depth 조합**: `get_figma_data(fileKey="...", nodeId="1234:5678", depth=2)` — 깊이를 제한하여 응답 크기 축소
2. **하위 노드 분할 조회**: 1단계 결과에서 자식 nodeId를 각각 개별 조회
3. **이미지 전환**: `download_figma_images`로 PNG를 다운로드하여 시각적으로 파악 후, 필요한 세부 노드만 재조회

## 금지 사항

- `get_figma_data(fileKey="...")` — nodeId나 depth 없이 전체 파일 조회 금지
- Figma URL에서 `node-id` 파라미터가 있으면 반드시 `nodeId`로 전달
