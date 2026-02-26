# 경로 별칭 (Path Alias)

## vite.config.ts / tsconfig.json
| 별칭 | 경로 | 용도 |
|------|------|------|
| `@` | `./src` | 현재 패키지 내부 |
| `@moz` | `../../libraries/moz-component/src` | 공유 라이브러리 |
| `@smart-report` | `../smart-report/src` | 스마트 리포트 참조 |
| `@font` | `../../libraries/moz-component/src/assets/default_font` | 폰트 에셋 |

## 공유 라이브러리 Import 예시
```typescript
// 컴포넌트
import { MozGrid } from '@vmscloud/moz-component';

// 스토어
import { useProjectInfoStore } from '@moz/stores';
import { useMenuStore } from '@moz/stores';
import { useQueryStore, apiCall } from '@moz/stores';

// 유틸리티
import { debounce, throttle, showMessage } from '@moz/util';

// 아이콘
import { IconSearch, IconEdit, IconDelete } from '@moz/icons';

// 그리드
import { ExtendFlexGrid } from '@moz/grid';
```
