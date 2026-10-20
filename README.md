# GeoAI Mobility Intelligence

런던을 중심으로 하는 React + TypeScript + Vite / CesiumJS 1.146.0 지도 MVP입니다.

## 실행과 검증

```sh
npm ci
npm run dev
npm run build
npm run lint
npm run preview -- --host 127.0.0.1
```

`build`는 TypeScript strict 타입 검사와 Vite 빌드를 함께 실행합니다. `vite-plugin-cesium`이 개발 서버에 정적 리소스를 제공하고 `dist/cesium/`에 Workers, Assets, Widgets, ThirdParty 및 Cesium.js를 복사합니다. `dist` 전체가 배포 단위입니다. Vercel에서는 Vite 프리셋, build 명령 `npm run build`, 출력 폴더 `dist`를 사용합니다. 실제 배포는 수행하지 않았습니다.

## 기능 및 데이터 상태

- 런던 마커, 카메라 이동/확대/축소, 실제 2D/3D 장면 전환, 런던으로 복귀.
- 배경지도·런던 마커·Road Network·Route & Endpoints 및 5개 시설 범주 스위치. 미구현 레이어는 비활성 상태.
- 참조 이미지의 상단 메뉴, 왼쪽 레이어, 중앙 지도, 오른쪽 대화 패널, 하단 분석 카드 구성.
- 교통 통계는 기본적으로 관측값 없음. “예시 차트 보기”는 고정된 가상 데이터를 표시하며 지도에 관측 데이터를 추가하지 않습니다.
- 데모 어시스턴트는 로컬 안내만 응답합니다. 별도 Route Planning 패널은 공개 OSRM 서비스로 실제 자동차 경로를 계산합니다. AI API 호출은 없으며 대화와 경로는 새로고침 시 초기화됩니다.
- 교통·사고·3D 건물·상세 지형·AI 백엔드는 연결되지 않았습니다. 시설 검색은 로컬 OSM 추출본을 사용합니다. 도로 표시는 로컬 OSM 추출본이며 경로 계산은 외부 OSRM 서비스입니다. 현재 지형은 타원체이며, 항공사진 및 실제 건물 모델을 제공하지 않습니다.
- 관측 타임스탬프가 없으므로 현재 시각을 교통 업데이트 시각으로 표시하지 않습니다.

## 배경지도와 연결 실패

개발용으로 `https://tile.openstreetmap.org/{z}/{x}/{y}.png`를 사용합니다. 런던을 포함한 전 세계 지도를 제공하지만 무료 무제한 호스팅이나 SLA를 보장하는 서비스는 아닙니다. 표준 브라우저 캐시와 Referer를 유지하고, 출처 표기를 지도 하단에 표시하며, 사전 다운로드·오프라인 캐싱·대량 요청 기능을 만들지 않았습니다. 타일 제공 정책을 배포 전에 다시 검토해야 합니다.

- [OSMF 타일 사용 정책](https://operations.osmfoundation.org/policies/tiles/)
- [OpenStreetMap 저작권 및 출처](https://www.openstreetmap.org/copyright)
- [Cesium OpenStreetMapImageryProvider](https://cesium.com/learn/cesiumjs/ref-doc/OpenStreetMapImageryProvider.html)

타일 로딩 오류 및 20초 이상 지연 시 오류 안내와 재시도 버튼을 표시합니다. “좌표 격자”는 외부 타일 요청 없이 동작하는 Cesium GridImageryProvider 대안입니다. 지리 배경이 없는 격자이므로 거리·지명·도로의 대체 자료로 사용하면 안 됩니다. WebGL 자체를 사용할 수 없는 경우에는 브라우저의 하드웨어 가속을 확인해야 합니다. Cesium ion 키와 유료 서비스는 사용하지 않습니다.

## 글꼴

한글 글꼴이 없는 환경을 위해 [Google Fonts의 Noto Sans KR](https://github.com/google/fonts/tree/main/ofl/notosanskr) Regular 폰트를 로컬 제공하며 OFL 라이선스를 `public/fonts/OFL.txt`에 포함했습니다. 전체 글꼴이므로 초기 다운로드 크기에 영향을 줍니다. `font-display: swap`으로 기본 글꼴을 먼저 표시합니다.

## 초기 지도 MVP 검증 기록

- `npm run build`: strict 타입 검사와 프로덕션 빌드 통과.
- `npm run lint`: 경고·오류 없음.
- 로컬 Chromium에서 프로덕션 OSM 지도, 런던 마커, 한글 폰트 표시 확인.
- 외부 타일을 자동 탐색하지 않도록 카메라 테스트는 로컬 격자에서 수행: 실제 Viewer의 2D/3D scene mode, 확대, 마커와 배경지도 visibility 통과.
- 메뉴 전환, 미연결 상태 안내, 명시적인 데모 차트, 로컬 대화 응답 확인.
- 390px 모바일 너비에서 가로 넘침 없음.
- 개발 서버의 StrictMode에서 캔버스 하나 유지. OSM 요청 차단 시 오류 안내, 로컬 격자로 복구 확인.
- 브라우저 검사 중 처리되지 않은 앱 예외 없음. 실제 GPU/다양한 모바일 기기 및 배포 환경은 별도 검증이 필요합니다.
- 검증 환경의 Chromium 오디오 라이브러리는 `/tmp`에만 추출하여 사용했고 시스템 패키지는 설치하지 않았습니다.

## 수동 검증 항목

1. WebGL 지원 브라우저에서 런던 마커와 OSM 출처 표시 확인.
2. 2D/3D 전환, 확대·축소, 런던 복귀 확인.
3. 두 레이어 스위치의 실제 표시/숨김 및 재초기화 후 상태 유지 확인.
4. 좌표 격자 전환, OSM 복귀, 네트워크 실패 안내 확인.
5. 메뉴 선택, 데모 대화, 예시 차트 표시/숨김 및 모바일 너비 확인.
6. React StrictMode 재마운트 후 Viewer 중복·누수 없이 단일 지도 유지 확인.

다음 단계는 자체 호스팅 또는 운영 계약이 있는 라우팅 제공자로의 전환과, 시설 출입구·차량 접근 가능 여부 검증입니다.

## 도로 네트워크 및 경로 시각화 마일스톤

UI는 영어로 유지합니다. 기존 React/TypeScript/Vite/CesiumJS 버전과 레이아웃을 유지했으며 새로운 런타임 의존성은 없습니다.

### 실제 OSM 도로 데이터

- 출처: [FOSSGIS Overpass API](https://overpass-api.de/api/interpreter), [이용 안내](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html).
- 영역: Westminster–Trafalgar Square 주변. WGS84 `[west, south, east, north] = [-0.135, 51.500, -0.115, 51.513]` (약 1.4 × 1.4km).
- 수집: `2026-10-19T21:21:23Z`; 응답의 OSM 기준 시각: `2026-10-19T21:20:06Z`.
- 실제 OSM way 953개, 좌표점 4,225개. `highway`의 motorway/trunk/primary/secondary/tertiary 및 link, residential/unclassified/service/living_street를 포함합니다. 보행로·자전거로 전체를 포함하는 자료가 아닙니다.
- 쿼리 영역과 교차하는 **완전한 way**를 보존하므로 일부 좌표는 상자 밖까지 이어집니다. 임의 도로 생성·스냅·단순화는 하지 않았습니다.
- 원본: `data/london-roads.overpass.json`. 화면용 검증·변환본: `public/data/london-roads.json`. 후자에 정확한 쿼리, 시각, bbox, 원본 SHA-256과 출처를 기록합니다.
- 라이선스: [© OpenStreetMap contributors / ODbL 1.0](https://www.openstreetmap.org/copyright). 원본과 변환 추출본에 동일한 데이터 라이선스가 적용됩니다. 지도 범례와 경로 패널에 출처를 표시합니다.
- 도로 클래스별 색상은 도로 종류를 의미하며 교통 속도/혼잡 관측이 아닙니다. 회색 외곽선은 조회 영역입니다.
- 최대 1,500 ways / 30,000 points를 가져오기 및 런타임 검증에서 제한합니다. 도로 데이터는 로컬 정적 파일에서만 읽습니다. 미완성 Overpass 응답(remark), 잘못된 geometry 또는 제한 초과 시 기존 파일을 대체하지 않습니다.

### 재현 가능한 가져오기

```sh
npm run data:roads
# 기존 파일이 있으면 네트워크 요청 없이 그대로 사용합니다.

npm run data:roads -- --refresh
# 의도적인 갱신에만 사용: 작은 고정 영역을 한 번 요청하며 자동 재시도하지 않습니다.
```

이 환경에서는 첫 Node 요청이 시간 초과되어 동일 쿼리를 curl로 한 번 실행해 성공했습니다. 요청 한도/과부하가 발생하면 자동 반복하지 말고 나중에 다시 시도하세요. 기본적으로 저장된 fixture만 사용하면 됩니다. 프록시 등으로 Node fetch를 사용할 수 없는 경우:

```sh
curl -fS --max-time 40 \
  --user-agent 'GeoAI-Mobility-Intelligence/0.1 (London local fixture import)' \
  --data-urlencode data@scripts/london-roads.overpassql \
  https://overpass-api.de/api/interpreter -o /tmp/london-roads.json

# 아래 시각은 실제 다운로드 시각으로 바꿉니다. --input은 네트워크를 호출하지 않습니다.
npm run data:roads -- --refresh --input /tmp/london-roads.json --retrieved-at 2026-10-19T21:21:23Z
```

### 실제 경로 계산 및 외부 서비스

- 엔진: OSRM. 제공자: [FOSSGIS routing.openstreetmap.de](https://routing.openstreetmap.de/about.html). 자동차 API: `https://routing.openstreetmap.de/routed-car/route/v1/driving/`.
- [OSRM API](https://project-osrm.org/docs/v5.24.0/api/)의 `route` 서비스에 GeoJSON 전체 geometry, 두 지점, 최대 100m 스냅 반경을 요청합니다. 자동차 서비스는 전 세계를 지원하지만 이 앱은 위 런던 테스트 상자 안의 입력만 허용합니다.
- 공식 안내에서 **최대 초당 1요청, 과도한 이용·스크래핑 금지, User-Agent/Referer 유지, 출처 및 Fix the map 링크**를 확인했습니다(확인일 2026-10-19). 전체 [독일어 약관](https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/)은 당시 접근 차단되어 전문을 확인하지 못했습니다. 공개 개발용 사용이며 SLA나 운영 배포 승인을 주장하지 않습니다. 운영 배포 전에 최신 전문 약관을 검토하고 자체 호스팅/적합한 계약 서비스로 전환해야 합니다.
- 경로 요청은 Find Driving Route 버튼을 누를 때만 전송합니다. 브라우저의 기본 User-Agent/Referer를 사용하며 앱 인스턴스당 1.1초 간격, 동시 요청 1개, 15초 제한을 적용합니다. 다중 탭/다중 사용자의 합산 속도 제한은 서버 운영 단계에서 별도로 필요합니다. 자동 재시도·좌표 변경 시 자동 요청은 없습니다.
- 좌표는 제공자에게 전송되고 로그에 남을 수 있음을 UI에 표시합니다. 인증 키·데이터베이스·AI·실시간 교통·SUMO는 사용하지 않습니다.
- 입력 방식: Route Planning 메뉴 → 경도, 위도 입력 또는 Pick origin/destination on map → Find Driving Route. Focus Road Area, Fit Route, Clear Route와 별도 경로 레이어 스위치를 제공합니다. 기본 좌표는 선택 예시이며 실제 경로는 요청 성공 시에만 표시합니다.
- 지도 마커는 사용자가 선택한 지점이고, 파란 경로는 서비스가 도로에 스냅한 경로입니다. 스냅 거리, 서비스 거리(m → km), 예상 시간(s → min), 제공자 및 OSM 출처를 표시합니다. **실시간 교통 예측이 아닙니다.** 실제 데이터 버전은 서비스가 제공할 때만 표시합니다.
- 로컬 도로 파일은 시각화 추출본이며 연결/방향/회전 제한을 갖춘 라우팅 그래프가 아닙니다. 경로 계산은 제공자의 별도 OSM 그래프를 사용하므로 시각과 도로 범위가 다를 수 있습니다. 오프라인 경로 계산은 제공하지 않습니다.
- HTTP 오류, rate limit, NoRoute/NoSegment, 비정상 JSON/geometry/거리/시간/스냅 위치를 검증합니다. 입력 변경·지우기·컴포넌트 정리 시 진행 중 요청을 취소하고 이전 응답이 새 상태를 덮어쓰지 못하도록 합니다.
- 외부 서비스 장애 시 기존 OSM 도로와 지도는 계속 사용할 수 있으며 가짜 대체 경로를 그리지 않습니다. OSM 타일도 실패하면 Local Grid로 전환할 수 있습니다.

### 구현 파일과 테스트

- `src/lib/mobility.ts`: 데이터 타입, 좌표/OSRM 응답 검증, 경로 요청, 도로 스타일.
- `src/hooks/useMobility.ts`: 데이터 로딩, 입력/요청/취소 상태.
- `src/hooks/useMapOverlays.ts`: 기존 Viewer에 도로·경로·마커·클릭 이벤트를 추가하고 정리.
- `src/components/RoutePlanner.tsx`: 기존 오른쪽 패널의 경로 입력·결과 UI.
- 기존 App, CesiumMap, AssistantPanel, App.css: 레이어와 메뉴 연결. `scripts/` 및 `data/`: 재현 가능한 가져오기와 출처 보관.

```sh
npm run build
npm run lint
npm run test
```

Node 내장 테스트 러너와 기존 Node 22의 TypeScript stripping을 사용하므로 테스트 의존성을 추가하지 않았습니다. 테스트 fixture의 가상 응답은 테스트 파일 안에만 있으며 UI나 실제 데이터에 포함되지 않습니다.

실제 Chromium 경로 호출에서 **901.5m / 149.4초 / 84개 좌표점** 응답을 확인했습니다. 브라우저 테스트에서는 OSM 타일 자동 탐색을 피하기 위해 로컬 격자 위에서 실제 도로 및 경로 geometry를 검증했습니다. 이는 검증 당시 결과이며 현재 교통이나 서비스 가용성을 보장하지 않습니다.

검증 결과: `npm run build`, `npm run lint`, `npm run test` 모두 통과했습니다. 직접 실행한 Node 테스트 9개가 통과했고, 실제 OSM 파일 검증과 route response/HTTP/rate-limit/JSON/NoRoute/NoSegment/입력 범위/취소 검증을 포함합니다. Chromium에서 도로·경로 레이어 토글, 실제 2D/3D 전환, 클릭 선택, 지우기, 모바일 입력 폼과 영어 UI를 확인했습니다. 외부 서비스에 추가 요청하지 않고 기록된 실제 응답 및 명시적인 모의 실패 응답으로 서버 오류·잘못된 JSON·경로 없음·취소 후 늦은 응답·도로 파일 오류/빈 상태를 검증했습니다. 처리되지 않은 런타임 예외는 없었습니다.

## 시설 검색 및 시설 목적지 경로 마일스톤

기존 영어 UI, Cesium 지도, 로컬 도로 953개와 OSRM 요청·검증·취소 처리를 유지했습니다. 별도 서비스나 런타임 의존성을 추가하지 않았습니다.

### 시설 출처와 범위

- 동일 런던 영역: `[west, south, east, north] = [-0.135, 51.500, -0.115, 51.513]`.
- 출처: `https://overpass-api.de/api/interpreter`. 실제 다운로드 시각 `2026-10-19T21:33:10Z`; 응답의 OSM 기준 시각 `2026-10-19T21:31:21Z`.
- 원본 `data/london-facilities.overpass.json`; 화면용 로컬 파일 `public/data/london-facilities.json`; 재현 쿼리 `scripts/london-facilities.overpassql`.
- 최종 시설 **25개**: 클리닉 1, 학교 2, 약국 6, 슈퍼마켓 10, 교통역 6. 의료 범주의 최종 표시 시설은 `56 Dean Street` 클리닉이며 병원으로 표시하지 않습니다.
- 조회 태그: `amenity=hospital|clinic|school|pharmacy|bus_station`, `healthcare=hospital|clinic|pharmacy`, `shop=supermarket`, `railway=station|halt`, `public_transport=station`. node/way/relation을 한 번의 union 쿼리로 조회합니다. 일반 버스 정류장·플랫폼·편의점·모든 의료시설을 포괄하는 자료가 아닙니다.
- node는 OSM 좌표, way/relation은 Overpass의 bounding-box 중심점입니다. **면적 중심은 출입구나 실제 진입 가능한 지점이 아닙니다.**
- 원본 28개에서 중심점이 영역 밖인 St Thomas’ Hospital(`way/122227536`), Covent Garden 건물/터널 관계(`relation/15698857`) 2개를 제외했습니다. 영역을 교차하는 병원 면적이 조회되었지만, 기존 라우팅 입력 범위를 지키기 위해 영역 밖 중심점을 표시하거나 목적지로 사용하지 않습니다.
- Leicester Square 역 node와 동일 역의 건물/터널 relation은 1개 마커로 통합하고 두 원본 ID를 보존했습니다. Charing Cross 지하철역과 철도역 등 실제 별개 역은 유지합니다.
- 중복 처리: 같은 OSM type/id, 동일 범주·정규화 이름이고 약 8m 이내인 표현, 또는 이름 접두부가 일치하고 100m 이내인 역 지점/건물·터널 관계를 통합합니다. 이는 보수적 표시용 정리이며 모든 현실 중복을 해결한다고 보장하지 않습니다. 원본 데이터는 항상 보관합니다.
- 파일에 조회 태그·범위·수집 시각·OSM 시각·제외/중복 수·원본 SHA-256·출처를 저장했습니다. [© OpenStreetMap contributors / ODbL 1.0](https://www.openstreetmap.org/copyright)이 원본과 변환 추출본에 적용됩니다. 검색 패널과 시설 상세에 출처·원본 링크를 표시합니다.

### 재수집과 오류 처리

[Overpass의 현재 운영 안내](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html)를 확인하고 작은 고정 영역만 조회했습니다. 첫 요청은 HTTP 502였으며, 구현 중 간격을 두고 동일 쿼리를 한 번 수동 재시도하여 성공했습니다. 자동 재시도·폴링·범위 확장은 없었습니다. 런타임에는 Overpass를 호출하지 않습니다.

```sh
npm run data:facilities
# 파일이 이미 있으면 외부 요청 없이 그대로 사용
npm run data:facilities -- --refresh
# 의도적인 갱신: 고정 영역의 단일 요청, 자동 재시도 없음
```

Node fetch가 사용할 수 없는 환경에서는 원본을 명시적으로 받아 가져올 수 있습니다:

```sh
curl -fS --max-time 40 \
  --user-agent 'GeoAI-Mobility-Intelligence/0.1 (London local facility fixture import)' \
  --data-urlencode data@scripts/london-facilities.overpassql \
  https://overpass-api.de/api/interpreter -o /tmp/london-facilities.json

# 실제 다운로드 시각을 사용하세요. 로컬 import는 외부 요청을 하지 않습니다.
npm run data:facilities -- --refresh --input /tmp/london-facilities.json --retrieved-at 2026-10-19T21:33:10Z
```

응답 최대 2MB, 원본 객체 최대 2,000개, 마커 최대 500개를 제한합니다. Overpass의 `remark` 오류/불완전 응답은 기존 파일을 대체하지 않습니다. 개별 좌표/태그 누락과 범위 밖 중심점은 제외 수로 기록합니다. 정상적인 빈 응답은 빈 데이터 상태로 보존합니다. 런타임은 파일을 검증하고 로딩·오류·빈 검색 결과를 구분하며, 오류 시 Retry Facilities로 로컬 파일을 재시도할 수 있습니다. 수집 시점 이후 변경이나 OSM 누락 가능성이 있습니다.

### 사용 방법과 기존 경로 연결

1. Facility Accessibility 메뉴에서 이름과 범주로 검색합니다. 모든 검색은 로컬 배열에서 수행되며 입력할 때 외부 검색 서비스를 호출하지 않습니다.
2. 결과를 키보드/포인터로 선택하거나 H/S/P/M/T 문자와 색상으로 구분한 지도 마커를 클릭합니다. 선택하면 해당 범주가 켜지고 지도가 해당 위치로 이동합니다. 카테고리 필터는 검색 결과만, 왼쪽 스위치는 지도 표시만 제어합니다.
3. 이름이 없는 시설은 `Unnamed …`로 표시합니다. 상세에 OSM 시설 종류, 좌표·위치 유형, 제공된 주소·운영자·개방시간·휠체어 접근 태그·전화·웹사이트 및 원본 ID를 표시합니다. 없는 주소는 `Not provided in OSM`, 개방시간은 검증되지 않은 원본 값으로 안내합니다. 외부 웹사이트 링크는 HTTP(S)만 허용하며 원본 텍스트는 React로 이스케이프합니다.
4. Use as Route Destination은 기존 목적지 입력만 채우고 Route Planning을 엽니다. 기존 출발지는 보존하고 이전 경로·진행 요청은 취소합니다. 아직 외부 경로 요청은 하지 않습니다.
5. Find Driving Route를 누르면 기존 FOSSGIS OSRM 요청을 실행합니다. 제공자·거리·예상 시간·출처가 표시됩니다. 시설 정보와 출입구 검증 한계를 안내하며 **실시간 교통을 반영한 시간이 아닙니다**.
6. 목적지를 수동 수정하거나 지도에서 다시 선택하면 시설 연관 표시가 해제됩니다. 다른 시설을 선택하거나 Clear Route로 이전 경로를 지울 수 있습니다. 시설 중심이 도로에서 100m 이상 떨어진 경우 NoSegment, 연결 가능한 자동차 경로가 없으면 NoRoute 안내를 표시하며 임의 대체 경로를 만들지 않습니다.

필요한 외부 서비스는 기존 OSM 배경지도와 명시적 요청 시의 FOSSGIS OSRM입니다. 시설/도로 표시·이름 검색은 로컬 데이터만 사용합니다. 공개 경로 서비스의 운영 가용성은 보장하지 않으며 기존 약관 확인 한계는 앞 절과 같습니다.

### 시설 단계 검증

- `npm run build`, `npm run lint`, 기존 `npm run test` 실행. 새 시설 단위 테스트 9개와 기존 경로 테스트 9개를 포함합니다.
- 새 테스트: 태그 분류, 이름/범주 필터와 빈 결과, 이름·선택 필드 누락, 불완전/빈/잘못된 데이터, 중복 처리, 시설 목적지 좌표 순서·범위, 안전한 웹사이트 링크, 실제 로컬 fixture 검증.
- 실제 외부 요청: Overpass 2회(첫 HTTP 502, 재시도 성공); Chromium에서 `56 Dean Street` 클리닉으로 명시적 OSRM 요청 1회 성공. 거리 **968 m**, 예상 소요시간 **173.5초**를 서비스 응답으로 확인했습니다. 다른 모든 시설의 자동차 접근이나 출입구는 검증하지 않았습니다.
- Chromium: 검색 중 외부 요청 0회, 마커 25개/도로 953개 유지, 범주 토글, 검색/마커 선택과 카메라 이동, 시설 목적지 입력과 출발지 보존, 기존 2D/3D와 수동 좌표 수정, 모바일 화면 및 영어 UI를 확인했습니다.
- 시설 실패/빈 데이터/손상된 파일 복구와 경로 없음/도로 스냅 실패는 브라우저의 모의 응답으로 검증하며 실제 서비스 장애라고 주장하지 않습니다.

주요 추가 파일: `src/lib/facilities.ts`, `src/hooks/useFacilities.ts`, `src/hooks/useFacilityMap.ts`, `src/components/FacilitySearch.tsx`, `scripts/import-facilities.mjs`, `scripts/london-facilities.overpassql`, `tests/facilities.test.mjs` 및 두 시설 데이터 파일. App·CesiumMap·AssistantPanel·RoutePlanner·useMobility에 기존 기능과 연결하는 최소 변경을 적용했습니다.

---

## 기존 Vite 템플릿 안내

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Cesium basemap recovery (October 2026)

The reported 20-second loading error was reproduced in Chromium. The viewer had an 882 × 570 canvas, the default render loop was active, and 379 frames had rendered, but the four initial requests to `https://tile.openstreetmap.org/1/{x}/{y}.png` remained pending and `globe.tilesLoaded` was false. Outside the filesystem sandbox, DNS resolved the tile host, but direct HTTPS connection attempts timed out (curl exit 28 after 15 seconds; IPv6 also reported network unreachable). This verifies an imagery connectivity failure in this environment, not a Cesium construction, asset-path, token, or WebGL failure. No HTTP response was received, so there is no evidence of a tile-server HTTP rejection or CORS rejection. The specific upstream network restriction cannot be determined from this workspace.

Previously, the imagery deadline showed “Unable to Load Map” even after successful rendering. Provider and render callbacks discarded their original errors, and grid/retry actions recreated the entire viewer and every overlay. Now `src/lib/basemap.ts` owns a single replaceable imagery layer. Provider errors and the unchanged 20-second imagery deadline automatically switch to `GridImageryProvider`, preserving the viewer, camera, roads, facilities, route entities, and input handlers. Replacement is deferred out of Cesium's tile-error callback. Listeners, timers, and stale callbacks are cancelled on switch/unmount. Hidden imagery pauses its deadline. Successful loading requires tile activity followed by a completed rendered frame; viewer readiness separately follows the first frame.

The dashboard retains the imagery error and logs the complete Cesium error object; **Continue with Local Grid** dismisses the notice and **Reconnect to OSM** retries only imagery. Initialization, rendering, and first-frame failures have separate diagnostics. Viewer failures require a viewer retry; grid imagery still requires a functioning WebGL viewer. Cesium's duplicate render-error HTML panel is disabled because it blocked the dashboard retry action; the dashboard displays and logs the original render error itself. The design, English UI, local OSM road/facility data, search, and OSRM routing remain in place.

Validation commands:

```sh
npm run build
npm run lint
npm test
npx playwright install --with-deps chromium
npm run test:browser
```

Set `CHROMIUM_EXECUTABLE` if using an existing Chromium installation. Browser tests use software WebGL for headless execution. Unit coverage includes successful imagery, network errors, timeout, grid/reconnect recovery, hidden imagery, stale callbacks, and cleanup. Chromium coverage includes repeated switches without new viewers or duplicate entities, unmount destruction, network-error details and reconnection, pending-request timeout, WebGL initialization failure, render-error retry, facility search, 2D/3D controls, and OSRM route overlays on the local grid.

The production build was also checked against the real unavailable tile host: packaged Cesium assets returned HTTP 200, imagery timed out into a working grid, one canvas remained, zoom stayed enabled, and no new external tile requests were made after switching to the grid. Successful imagery and OSRM browser cases use controlled responses; this run does not establish live OSM or OSRM availability. The grid is a local visual reference, not a geographic basemap, and public external services still require connectivity.

Final results: production build and lint passed; all **26 unit tests** and **6 Chromium tests** passed. Changed files: `src/components/CesiumMap.tsx`, new `src/lib/basemap.ts`, new `tests/basemap.test.mjs`, new `tests/browser/map.spec.ts`, new `playwright.config.ts`, `package.json`, `package-lock.json`, `.gitignore`, and this README.

## Urban GIS visual upgrade (October 2026)

### Verified starting point

The original map used `EllipsoidTerrainProvider` (no sampled elevation), raster OSM imagery, and road polylines clamped to that surface. Its initial camera was at latitude 51.47 and 9,000 m altitude, well south of and far above the small Westminster–Trafalgar extract, which occupied little of the rendered canvas. Route fitting and facility selection forced a top-down camera. Switching to 3D changed perspective but could not create buildings or elevation. The Buildings and Terrain entries were disabled placeholders with no loading code, configured URL, or project ion token.

The local road source contains 953 highway ways and no buildings/heights. The facility source contains 28 raw records, including three `building` tags, but no heights or resolved polygon coordinates for those buildings; its normalized output contains 25 point/area-center facilities. No elevation, quantized-mesh terrain, glTF city model, or 3D Tiles tileset is bundled. The UI now explicitly describes the ellipsoid and unavailable 3D sources. No footprints, building heights, terrain, water boundaries, or other geographic features were invented.

### Implemented rendering

- OSM imagery receives a restrained dark treatment using Cesium imagery-layer brightness, saturation, contrast, and gamma. This is styled raster imagery, not a new dark-map service. No new service or API key is required.
- The fallback is a sharper, low-contrast local grid on the same dark surface. Roads, facilities, search, routing, and controls continue working independently of imagery availability. The existing error logging, single-viewer recovery, and 20-second imagery deadline are retained.
- An oblique camera frames the actual study bounds, with consistent framing for Home, Focus Road Area, selected facilities, and routes. 2D remains top-down; 3D restores the study-area perspective. Sky/sun/moon effects are hidden for a restrained GIS canvas.
- Road classes have a consistent muted palette and thin dark casing. The cyan route has a contrasting outline and higher ground-layer ordering; mint origin and amber destination markers have separate label offsets.
- Facility badges are smaller, use distance-dependent scaling, and show names only for the selected facility. Unselected facilities within 45 m of the route are reduced in size and opacity; they remain selectable and retain category visibility controls. This is display decluttering, not an accessibility calculation.
- The central map receives more screen height and width. The legend is collapsible, attribution has a dedicated bottom strip, imagery warnings are compact, and mobile/tablet controls remain inside the map. OSM attribution remains visible with the grid and collapsed legend.

### Source availability and requirements

| Source | Coverage / format | License, attribution and network requirements | Status in this project |
| --- | --- | --- | --- |
| Existing local OSM roads/facilities | Westminster–Trafalgar bounded extract; complete road ways may extend outside the query box | [OSM ODbL and attribution](https://www.openstreetmap.org/copyright); files served by the app, no external requests for display/search | Working |
| OSM standard raster tiles | Global tiled raster; no elevation or building geometry | OSM attribution and [tile usage policy](https://operations.osmfoundation.org/policies/tiles/); HTTPS to `tile.openstreetmap.org` | Optional; prior investigation verified connectivity timeouts in this environment |
| Local grid | Procedural visual reference, not a geographic basemap | Generated by Cesium in the browser; no external tile requests | Working fallback |
| [Cesium OSM Buildings](https://cesium.com/platform/cesium-ion/content/cesium-osm-buildings/) | Global 3D Tiles derived from OSM; completeness and recorded heights vary | Requires ion access/entitlement, token, HTTPS to ion API and returned asset hosts, OSM attribution and [ion terms](https://cesium.com/legal/terms-of-service/). Provider may estimate missing heights; those estimates are not surveyed measurements | Unavailable; no source/token configured or integration enabled |
| [Cesium World Terrain](https://cesium.com/platform/cesium-ion/content/cesium-world-terrain/) | Global quantized-mesh; published England source resolution approximately 1–2 m, actual local quality unverified here | Requires ion access/entitlement, token, network streaming and source credits supplied by Cesium; ion terms apply | Unavailable; no source/token configured or integration enabled |

CesiumJS can support these 3D formats, but a working source must first be supplied and licensed for the intended deployment. Adding a token alone will not activate layers in this change. A future integration should explicitly load the source, expose loading/error/ready states, cancel stale requests, retain required credits, and recover to the ellipsoid/local data. No ion service is called by this version, and no paid API key requirement has been introduced.

### Changed files and verification

| File | Purpose |
| --- | --- |
| `src/components/CesiumMap.tsx` | Scene/imagery treatment, camera integration, compact overlays, permanent local-data credits |
| `src/lib/mapVisual.ts` | Shared oblique framing and distance-to-route decluttering calculation |
| `src/hooks/useMapOverlays.ts` | Road casing, route emphasis, endpoint labels and route framing |
| `src/hooks/useFacilityMap.ts` | Smaller badges, selected labels, route-aware decluttering, facility framing |
| `src/lib/mobility.ts` | Restrained road-class palette |
| `src/lib/facilities.ts` | Consistent facility category colors |
| `src/App.tsx` | Explicit unavailable building/terrain source states |
| `src/App.css` | Map-first sizing, overlay spacing, attribution and responsive layout |
| `tests/map-visual.test.mjs` | Segment-distance and degenerate-route coverage |
| `tests/browser/map.spec.ts` | GIS controls, facility selection, route visibility, mode behavior, missing sources, responsive bounds; robust test instrumentation for Vite hot-reload URLs |
| `README.md` | Investigation, source requirements, implementation and validation record |

Build and lint passed. All 28 unit tests and the expanded 9-case Chromium suite passed. The suite includes the previous successful-imagery, network failure, timeout, reconnect, render-error and cleanup cases, plus road/category visibility, facility selection, route visibility, actual 2D/3D scene modes, disabled 3D layers, no ion requests, and 390/820 px responsive layouts. Desktop (1440 px) and mobile (390 px) renders were visually inspected, including the route line and endpoint labels. Successful imagery and routing tests use controlled responses; screenshots of the route use test geometry and do not establish live OSRM availability. Local-grid screenshots show the actual bundled road/facility extract. OSM imagery and user-requested OSRM routing remain the only external runtime data dependencies.

## Current setup: live Cesium ion buildings and terrain

This section supersedes the earlier unavailable-source status. The application now loads genuine **Cesium OSM Buildings (asset 96188)** and **Cesium World Terrain (asset 1)**. It uses `IonResource.fromAssetId` with the configured client credential, followed by the supported `Cesium3DTileset.fromUrl` and `CesiumTerrainProvider.fromUrl` APIs. It does not use Cesium's default demonstration token, create synthetic buildings, or invent elevation.

### Configure without disclosing credentials

1. Keep the client token in the existing project-root `.env.local` entry named `VITE_CESIUM_ION_TOKEN`. Edit its value privately; no value is shown in this documentation. Do not put credentials in source code, reports, screenshots, shell command arguments, or issue/PR descriptions.
2. Use a client token with `assets:read` access to **1** and **96188**, account access to those assets, and allowed origins matching the intended app host. The localhost tests below do not establish access from another deployment origin or commercial-use entitlement. Retain the credits supplied by Cesium and follow the linked provider terms in the source table above.
3. Optionally set these independent initial layer preferences in `.env.local`:

   ```dotenv
   VITE_CESIUM_BUILDINGS=true
   VITE_CESIUM_TERRAIN=true
   ```

   With a configured token, both default to enabled. Set either to `false` to start it off; the independent UI switches can still turn it on. Missing tokens disable the switches and issue no ion requests.
4. Restart Vite after changing environment variables. For production, rebuild and redeploy; Vite resolves these values at build time.
5. From the project root, run `node scripts/check-ion-access.mjs` to check the two asset endpoints. It reports only configuration presence, HTTP statuses, expected asset types and safe connection categories. It never prints the token, response bodies, headers or streaming URLs, and returns a failing exit code for denied/unavailable access.

`VITE_` credentials are client-side credentials: the browser must send them to the service, and production JavaScript includes build-time values. They cannot be treated as server-only secrets. Restrict scope/assets/origins appropriately. `.env.local` remains explicitly excluded by `.gitignore` and also matches its existing `*.local` rule; `dist` and browser-test output are ignored. The missing `.git` directory was left alone, no repository was initialized, and no commits were made.

### Independent loading and recovery

Each source reports **Loading**, **Streaming**, **Ready**, **Off**, or **Unavailable**, with its own switch and retry action. Metadata/endpoint success alone never sets Ready: buildings require selected tile content with features or triangles, and terrain requires downloaded geometry followed by a rendered frame. A 25-second connection/first-content deadline and subsequent tile errors remove the failed source. Terrain restores the ellipsoid; a building failure removes only that tileset. There is no automatic viewer recreation or repeated source retry loop. Stale loads are released instead of attached after disable, retry, viewer replacement or unmount.

The local grid changes raster imagery only. It can coexist with real terrain and buildings; turn **both ion switches off** for a map with no external 3D requests. Raster imagery retains its existing separate 20-second deadline and recovery. Imagery completion now tracks imagery-provider requests rather than aggregate globe progress, so slow terrain cannot be misreported as an OSM imagery failure.

Road and route polylines follow terrain and classify only terrain, while facility/endpoint markers and labels clamp to terrain rather than roofs. Endpoint picking uses the globe surface, with an ellipsoid fallback during loading. Existing local road/facility data, search, OSRM routing, category/visibility controls and camera modes are preserved. Heights/coverage are those of the source; OSM Buildings can include provider-estimated heights and incomplete mapping. Turning terrain off does not alter the buildings' source coordinates to create artificial ground alignment.

HTTP 401, 403, 404, 429 and other service statuses have credential-safe diagnostics. Messages do not echo raw signed URLs, headers, service bodies or exception objects. Console redaction also protects against Cesium's own metadata-error logging, while retaining safe messages and statuses. Regression tests explicitly override the real credential with an empty value in their Vite server; permission tests use a synthetic credential and controlled responses. Real credentials are never stored in test fixtures or browser traces.

### Verified live access and tests

- The private endpoint probe returned **HTTP 200 for both asset 1 and asset 96188**, with the expected resource types. There was no observed permission denial for these resources.
- Chromium downloaded genuine building content and **58 terrain mesh responses** in the initial geometry check. Selected building tiles contained **16,974 features and 393,568 triangles**; a real `CesiumTerrainProvider` was active, and both sources reached rendering-ready states. Building geometry was visually inspected. These counts describe selected tile content, not a census of visible or verified buildings.
- A separate live interaction check confirmed independent building/terrain off/on controls, ellipsoid restoration, unaffected companion layers, actual 2D/3D scene modes, **one building tileset and one canvas**, and preservation of **953 road ways plus the extent entity and 25 facilities**. No page errors were observed. Raster imagery was deliberately failed during these checks to verify coexistence with the local grid; ion resources were not mocked.
- Endpoint checks inside the filesystem/network sandbox initially returned DNS `EAI_AGAIN`. Outside that restriction, both endpoint and live browser access worked. Deployed-origin restrictions, future availability, rate limits, and commercial account licensing remain separate considerations. OSM raster and requested OSRM routes still depend on their external services; routing regression responses are controlled fixtures.

### Files changed for ion integration

| File | Purpose |
| --- | --- |
| `src/lib/ionConfig.ts` | Read the token privately and resolve independent initial preferences |
| `src/lib/remoteLayer.ts` | Resource ownership, readiness, timeout/retry, stale-request cleanup and safe errors |
| `src/hooks/useIonLayers.ts` | Real ion factories, rendering evidence, tile errors and independent source teardown |
| `src/components/CesiumMap.tsx` | Connect the sources, surface status, separate imagery progress from terrain |
| `src/App.tsx`, `src/App.css` | Independent layer switches, status and retry controls |
| `src/hooks/useMapOverlays.ts`, `src/hooks/useFacilityMap.ts` | Terrain clamping, terrain-only route rendering and surface picking |
| `src/lib/credentialLogs.ts`, `src/main.tsx` | Redact credentials in application and third-party console diagnostics |
| `scripts/check-ion-access.mjs` | Endpoint permission probe with safe output |
| `.gitignore` | Document the existing explicit exclusion for local credentials |
| `playwright.config.ts`, `tests/browser/map.spec.ts` | Isolate test credentials and retain missing-token regression coverage |
| `tests/browser/ion.spec.ts` | Permission failures, independent retry/toggles, in-flight disable and timeout |
| `tests/remote-layer.test.mjs`, `tests/credential-logs.test.mjs` | Lifecycle, independent failures, cleanup, HTTP diagnostics and log-redaction tests |
| `README.md` | Safe setup, live evidence, source behavior and limitations |

Final validation for this integration: `npm run build` and `npm run lint` passed; **41 unit tests** and **12 Chromium regression tests** passed. Live ion endpoint/geometry/interaction checks were separate from those credential-isolated regression tests. A source/documentation/test credential audit found no occurrences of the configured credential outside the intentionally ignored local environment file and build output.
The final viewer-failure status cleanup also passed its targeted Chromium recheck (successful switching/unmount and render-error retry, 2 cases).

## Vite HMR and OSM connectivity investigation

### Observed development environment

The inspected running process was plain `vite` (the `npm run dev` script), in this project directory with no host/port CLI overrides. It listened on **127.0.0.1:5173**. WSL reported **NAT** mode; its Windows host also had an IPv4 loopback listener on port 5173. No proxy environment variables were present in the inspected WSL process environment. No DNS, firewall, Windows execution-policy, networking-mode or port-forwarding settings were changed.

Fresh Chromium sessions successfully received Vite's authenticated WebSocket `connected` message from **both `http://localhost:5173/` and `http://127.0.0.1:5173/`**. Independent Windows-side checks returned HTTP 200 and opened the authenticated HMR WebSocket at both addresses. These checks also passed after the configuration change. The original failing browser's exact page URL, connection state and console history were not available, so its intermittent failure could not be reproduced or conclusively attributed to a specific cause. Stale clients, a different forwarded origin or proxy, and port/address mismatches are troubleshooting possibilities, not verified findings.

### Deterministic, private startup

```sh
npm run dev
```

Open **http://127.0.0.1:5173/**. `vite.config.ts` now explicitly binds IPv4 loopback and sets port 5173 with `strictPort: true`. An occupied port fails clearly instead of silently moving the server while a browser keeps using an older address. An intentional alternative port can still be selected with `npm run dev -- --port 5174`; open the corresponding printed URL.

HMR remains enabled and uses Vite's same-origin WebSocket inference and authentication. Its host, protocol and client port are not separately pinned; this also preserves intentional CLI port overrides and HTTPS/forwarded origins. Host validation, origin/CORS checks and filesystem protections retain their secure defaults. The server is not bound to all interfaces. The new browser regression verifies an actual watched-module update, no page reload, the same Cesium canvas, rejection of an untrusted Host, and no permissive cross-origin response.

If the original browser still fails, reload the canonical URL once after restarting the server and inspect that connection's HTTP/WebSocket status. A reverse proxy must forward WebSocket upgrades to the same server. Do not use `allowedHosts: true`, `cors: true`, disable HMR, or expose all interfaces as a workaround. Background: [Vite server options](https://vite.dev/config/server-options.html) and [Microsoft WSL networking](https://learn.microsoft.com/en-us/windows/wsl/networking).

### OSM timeout diagnosis and limits

One OSM tile **HEAD request per OS** was used for diagnostics, without retries or tile downloads. Both Windows and WSL resolved the host but timed out establishing a TCP connection after approximately 10 seconds. Curl reported HTTP **000**, connect time **0**, and TLS time **0**: neither a completed TCP connection, TLS negotiation nor an HTTP response was observed. Both independent ion asset checks returned HTTP **200**.

This demonstrates a network-path failure to the OSM tile endpoint shared by Windows and WSL, rather than the application's 20-second imagery timer, Cesium rendering, or an HTTP/CORS response. It does not identify the specific firewall, VPN, ISP, route, or CDN edge involved, and does not prove a global OSM outage. The application cannot repair that external TCP path. No alternate tile service, proxy, DNS override, certificate bypass or retry loop was introduced.

The existing imagery timeout remains **20 seconds**. It replaces only the imagery layer with the local grid, preserving the viewer, terrain, buildings, roads, facilities, search, route interactions and camera modes. A regression now checks that zooming after fallback starts no new OSM requests and that OSM attribution remains visible. Reconnection remains an explicit user action.

Requests still use the canonical OSM tile URL, native browser caching and normal browser identification/referrer behavior. There are no cache-busting parameters, forced cache bypass, bulk/offline tile downloads, or automatic retries. The local grid is procedural and does not download raster tiles. Follow the [OSMF tile usage policy](https://operations.osmfoundation.org/policies/tiles/); public tiles remain a connectivity-dependent service.

### Additional live Cesium regression found during verification

The real-source check exposed a separate 2D transition failure: `GeographicProjection.project` received an undefined cartographic coordinate through `FixedFrameTransforms.ellipsoidTo2DModelMatrix`, `ModelSceneGraph.updateModelMatrix`, and `Model3DTileContent.update`. This is independent of HMR and raster connectivity. `useIonLayers.ts` now enables the supported `projectTo2D: true` tileset option, using accurate model projection rather than the default mode-change model-matrix path. This costs additional projection memory, while preserving the same source geometry and single tileset.

With that option, the live check passed independent layer off/on controls, ellipsoid fallback, actual 2D/3D transitions, one tileset/one canvas, and preservation of 953 road ways plus their extent and 25 facilities. Genuine terrain meshes and nonempty building content rendered with OSM raster deliberately unavailable. No credentials, signed URLs, or WebSocket authentication values were printed. The original ion permission checks also returned HTTP 200 for both assets.

Changed files for this investigation: `vite.config.ts` (loopback/strict-port startup), `src/hooks/useIonLayers.ts` (accurate 2D model projection), `tests/vite-server.test.mjs` (occupied-port behavior), `tests/browser/hmr.spec.ts` (real HMR updates and security checks), `tests/browser/map.spec.ts` (no imagery retry after fallback and visible attribution), `.gitignore` (temporary HMR probe modules), and this README.
A further live check switched into 2D before ion geometry finished loading, observed nonempty selected building content and both sources Ready with no rendering failure, then restored 3D successfully. The inspected parent process chain confirmed `npm run dev → shell → Vite`.

Final results for this investigation: production build and lint passed, **42 unit tests** and **14 Chromium tests** passed. HMR tests exercise real filesystem updates on the CLI-overridden test port, occupied-port handling, and unchanged host/CORS protections. Imagery tests retain the 20-second deadline, no automatic requests after fallback, visible attribution, and a single viewer. Live ion geometry and early/late 2D–3D checks were verified separately from the credential-isolated regression suite. The precise cause of the original browser's HMR failure and the responsible component on the OSM TCP path remain unproven; neither was hidden by disabling errors, weakening security, or changing imagery services.
