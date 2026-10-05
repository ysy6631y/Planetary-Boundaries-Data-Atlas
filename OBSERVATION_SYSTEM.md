# Observation System

Decision: 2026-10-05. Phase 1 data and spatial layout remain unchanged.
Implementation decision is recorded below before code changes.

## 1. Source concepts extracted from the supplied astronomy text

Source: guhwang, [[지구과학] 천체의 관측](https://m.blog.naver.com/guhwang/220669127979).
PC source: [PostView](https://blog.naver.com/PostView.naver?blogId=guhwang&logNo=220669127979&redirect=Dlog&widgetTypeCall=true&directAccess=false).
이번 재검토는 이전에 직접 가져온 PC HTML의 `postViewArea` 본문 전체를 읽고,
정적 도해 30개를 다시 열어 진행했다. 모바일 URL은 이번 접근에서 실패했다.
미디어는 이미지 배치 32개(고유 이미지 30개)와 GIF/video 배치 4개다.
애니메이션 재생 확인 범위는 `research/astronomy-review.md`에 별도로 기록한다.
본문/도해를 재배포하거나 천문 그래픽 자산을 앱에 복제하지 않는다.

읽은 범위: 천구/천정/천저, 수직권/시간권/자오선, 방위 기준,
지평/적도 좌표, 남중고도/위도, 황도/계절, 안과 밖에서 본 회전 방향,
일주/연주 운동, 행성 순행/역행, 달의 위상/주기, 일식/월식까지.
특히 춘분점과 서점을 혼동하지 말라는 설명, 안/밖에서 회전 방향이 달라
보이는 도해, 마지막 식 도해의 수정 설명은 기준과 관측 조건의 중요성을 보여준다.

A = 적용 가능한 계산 원리, B = 제한적 시각적 은유, C = 물리적 의미를 가져오면 안 됨.

| 개념 | 원문의 실제 의미 | 프로젝트 대응 | 분류 / 왜곡 방지 |
|---|---|---|---|
| Celestial sphere / 천구 | 천체 방향을 표현하는 가상 구, 천극/적도/지평 기준 | 방향 안내용 구면과 각도 기준 | B. PB r=1/2는 위험 임계면이지 천구가 아니다. 모든 점을 같은 반지름에 올리지 않는다. |
| Observer-centered coordinates | 관측 위치와 기준에 대해 천체 방향을 읽음 | world position에서 camera-local 좌표를 파생 | A. 카메라가 지구/환경 상태의 원점이라는 뜻은 아니다. |
| Horizon coordinates | 관측자의 지평면/천정/북점에 대한 방향 | 카메라 right/up/forward에 대한 bearing/elevation | A는 상대 좌표 원리만. 실제 지리적 북쪽/중력/지평선은 없으므로 C인 물리 지평 좌표를 주장하지 않는다. |
| Equatorial coordinates | 천구 적도와 춘분점에 대해 적경/적위를 표시 | 고정 world basis와 별도 layout theta/phi | B. 지구 적도, 춘분점, 관측 epoch에 대응하는 데이터가 없다. 실제 적도 좌표로 부르지 않는다. |
| Altitude / azimuth | 지평면 위 고도, 북점에서 동쪽 방향으로 재는 방위 | 카메라 기준 수평각/고도각 | A. 앱은 forward=0, right=positive라는 다른 convention을 명시한다. 숫자를 천문 AltAz로 표시하지 않는다. |
| Declination / right ascension | 적도에서 각거리, 춘분점부터의 적도상 각위치(적경 시간 단위) | 안정된 layout 방향의 두 각도 | B. 원문의 24시간/15도 체계를 PB에 적용하지 않는다. 기존 phi는 극각이며 적위가 아니다. |
| Reference axis / plane | 천축, 적도면, 지평면이 측정 기준을 정함 | world +Y 또는 선택 group direction; camera image plane | A. 선택 축은 환경 인과축/위험축이 아닌 layout reference다. |
| Meridian | 천정/천저와 천극 등을 지나는 관측자 기준 대원 | 선택 축과 보조축이 정하는 단면의 개념 | B. 남중/정오라는 의미 없음. 현재 불필요한 자오선 장식은 추가하지 않음. |
| Apparent motion | 자전/공전과 관측 위치로 생기는 겉보기 운동, 행성 상대운동 | 카메라 변화에 따른 screen position/overlap 변화 | A는 시점 의존성만. C: 환경점의 가짜 공전/일주 애니메이션. |
| Coordinate transformation | 같은 천체를 다른 기준 좌표로 읽음 | world -> camera-local -> clip -> screen; world -> selected-axis basis | A. 원본 좌표를 덮어쓰지 않고 별도 파생값 생성. |
| Observer-dependent measurement | 관측 위치/시각/기준에 따라 방향/가시성이 달라짐 | sightline angle, screen offset, center-frustum membership | A. 환경 위험값 변화로 해석하면 왜곡. |
| 황도, 계절, 역행, 달 위상, 식 | 실제 천체 운동, 조명, 정렬과 주기 | 직접 대응 없음 | C. 환경 시간축/인과/차폐를 꾸며낼 근거가 없다. |

원문은 교육용 개념 자료이지 좌표 구현 명세가 아니다. 예를 들어 적도 좌표가
시간에 따라 변하지 않는다는 표현을 모든 천체/epoch에 대한 법칙으로 채택하지 않는다.
천구의 안/밖에서 보이는 시계 방향도 좌표 convention 없이 구현하지 않는다.
보충 확인: [Astropy coordinate transforms](https://docs.astropy.org/en/stable/coordinates/transforming.html),
[AltAz](https://docs.astropy.org/en/stable/api/astropy.coordinates.AltAz.html).
실제 AltAz는 관측 위치/시각 같은 frame 속성을 요구한다. 이 프로젝트는 천문 변환을 실행하지 않는다.

## 2. Concepts adopted

동일 대상의 복수 좌표 표현, 명시적인 기준축/평면, 관측 프레임과 대상 상태의 분리,
투영 결과의 가시성/겹침 판정, 관측 조건까지 포함하는 재현 가능한 측정을 채택한다.
관측기의 출력은 환경의 새로운 지표가 아니라 현재 읽는 방식의 측정값이다.

## 3. Concepts rejected

실제 RA/Dec 이름, 위도/태양고도 공식, 시간각, 천체 공전, 별 texture, 가짜 시간축,
위험면의 지구 모델화, 공간상 가까움을 생태적 관계로 간주하는 처리를 거절한다.
회전하는 dataRoot, 관측에 따라 riskScore를 재정규화하는 처리도 금지한다.
가짜 천체 궤적/자동회전/조명 위상은 추가하지 않는다.

## 4. STATE SPACE definition

`raw source -> original riskScore -> r -> fixed unit direction u -> p = r*u`.
원본 점수, raw/unit/threshold/direction, 9 groups, 11 numeric points와 두 NQ 상태,
source IDs, 고정 layout directions를 보존한다. `|p-O| = r`, O=(0,0,0).
Fibonacci 9방향 및 동일 boundary 두 control의 +/-3도 offset은 기존 layout이다.
관측과 상관없이 고정되며 과학적 각거리 의미는 없다.
Genetic Diversity의 category 3은 r이 아니다. Novel Entities에도 XYZ가 없다.
각 group은 direction/identity/membership을 갖지만 representative position은 없다.

고정 relation records도 이 layer에 속한다. 현재 공간에 있는 것은 measurement
edge 11개뿐이다. raw group membership은 확인되지만 analytical edge graph는 아직 구축하지 않는다.
runtime에서 state를 deep-freeze하고 저장된 state와 실제 mesh world coordinates의 동일성을 검증한다.
반지름 검증만으로는 dataRoot의 임의 회전을 잡지 못하므로 좌표 동일성 검증도 필요하다.

## 5. OBSERVER FRAME definition

`camera C, camera quaternion Q, target T, projection/FOV/aspect, selectedEntity,
selectedReferenceAxis, view basis, viewport size`를 독립 관리한다.
`observationDistance = |C-T|`는 data distance가 아니다.

두 종류의 target을 구분한다.
- Semantic target: 선택 boundary/control ID. NQ도 선택 가능.
- Orbit pivot: 실제 기하학적 카메라 중심. system/group 방향 관측은 O,
  numeric control focus만 원본 p를 사용한다. 그룹 평균이나 임의 r은 만들지 않는다.

Boundary 선택은 selected axis/local basis를 갱신한다. group 방향 정렬 명령은
카메라를 해당 방향 쪽으로 옮겨 O를 보게 한다. 이 경우 group은 관측 맥락이지
공간에 새로 생긴 대표점이 아니다. NQ도 같은 방향 관측을 지원한다.

선택축 a의 local basis: z=a, 보조 up는 world +Y (평행에 가까우면 +X),
x=normalize(up cross z), y=z cross x. `q_axis = B^T(p-O)`.
이는 origin 중심 회전만이므로 `|q_axis|=r`. 반면 카메라 중심 변환은 아래와 같다.

## 6. PROJECTED VIEW definition

Three.js camera basis는 right=+X, up=+Y, forward=-Z.
`q_camera = Q^-1(p-C)`; `depth=-q_camera.z`.
`bearing=atan2(q.x,-q.z)`, `elevation=atan2(q.y,hypot(q.x,q.z))`.
수직 sightline의 bearing과 p=C일 때 모든 방향각은 undefined로 표시한다.
이 값은 지리적 azimuth/천문 고도가 아니라 camera-relative angle이다.

`clip=P*V*[p,1]`, NDC=clip.xyz/clip.w, screen=((ndc.x+1)W/2,(1-ndc.y)H/2).
screen distance는 viewport CSS pixel이며 DPI/viewport/FOV에 의존한다.
선택점과 투영 origin 사이 거리는 둘 다 camera 앞에 있고 depth clip 안에 있을 때만 계산한다.
화면 밖이면 그 거리도 viewport 내부의 실제 선 길이로 오해하지 않도록 visibility와 같이 표시한다.
뒤쪽 점을 clamp해서 화면 안의 관측점으로 만들지 않는다.

center-frustum 판정은 depth/clip volume 안에 있는 **점 중심**만 판정한다.
visible이라고 해서 다른 mesh/UI에 가리지 않았음을 보장하지 않는다.
apparent overlap은 두 frustum 내부 projected centers가 10 CSS px 미만이라는
명시적 화면상 근접 기준이며 물리 충돌/상관관계/정확한 glyph occlusion이 아니다.
현재 projection plane은 camera image plane, 법선은 camera forward다.

`angle(u,a)`는 고정 world direction과 선택축의 각이다. 같은 축을 유지하면
카메라 orbit으로 바뀌지 않는다. observer 값인 bearing/elevation과 구분해 표시한다.
NQ는 위치가 없으므로 screen distance, camera-local point, point overlap 모두 null이다.
direction-only frame 선택은 가능하지만 NQ label 좌표를 데이터 관측값으로 쓰지 않는다.

## 7. Fixed values vs observer-dependent values

| 종류 | 값 | 바뀌는 조건 |
|---|---|---|
| Environmental data | raw/unit/threshold/r/data status | 검증된 source version 변경만 |
| Fixed layout | group u, offsets, p, theta/phi | 명시적 layout revision만; 이번에는 불변 |
| Fixed evidence | membership, measured/analytical relation record | 새 근거 또는 분석 revision만 |
| Reference-relative | axis-basis XYZ, angle(u,a) | 선택 기준축 변경; orbit만으로 안 바뀜 |
| Observer state | C/T/Q/FOV/viewport | 사용자 관측 조작/resize |
| Observer-derived | bearing/elevation/depth/screen/overlap/frustum | observer 변경 |
| Presentation | label displacement, glyph size, edge visibility | 충돌 회피/LOD/toggle; 데이터 아님 |

같은 숫자라도 label placement distance, world risk radius, camera distance,
local analysis axis units를 합쳐 표시하지 않는다. projected proximity는 relation이 아니다.

## 8. Interaction model and three alternatives

| 평가 | A. Immersive flight | B. Dual-frame observation instrument | C. Multiscale analytical atlas |
|---|---|---|---|
| Conceptual logic | 하나의 camera가 field에서 target로 진입 | fixed state와 observer/projected readings를 동시에 검사 | group 맥락에서 별도 단위의 로컬 분석으로 전환 |
| Data integrity | r 고정 가능하지만 접근=위험변화 오해 큼 | 원본/파생/기준축을 분리하고 invariance 실시간 검증 | 단위 격리하면 안전; global-local mapping 검증 필요 |
| Usability | 탐험은 자연스럽지만 값 비교 어려움 | 계기 수가 늘어도 무엇이 바뀌는지 명확 | 분석에 효율적이나 여러 공간의 길찾기 비용 |
| Visual potential | 깊이감 높음, 장식화 위험 큼 | 겹침 해소, 기준축/투영 실험, snapshot 비교 | XY/XYZ/distribution의 목적별 전환 |
| NASA Eyes compatibility | dolly/orbit/target fly-to와 매우 유사 | 같은 controls + 계기 overlay 분리 가능 | system-to-detail flow를 적용, 연속 줌은 제한 |
| Portfolio explainability | 탐험 경험은 쉽지만 3D 필요성 약함 | 불변성과 관측 의존성의 수식/시연이 명확 | 데이터 provenance와 분석 연결은 강함, 구현범위 큼 |

**추천/이번 구현 결정: B.** A의 navigation을 입력으로 사용하고 C는 이후 검증된
analysis layer로 연결한다. 세 안을 동시에 완성하지 않는다. 기존 r/XYZ/layout은 수정하지 않는다.
최소 변경: observation 계산 모듈, 별도 observer inspector, reference axis 선택,
group direction 정렬, 좁은 wheel step, 원본/좌표 불변성 검사. UI 미장센은 유지한다.

Wheel은 canvas 위에서만 page scroll 대신 dolly로 해석한다. 요청대로 deltaY>0이면
inward, <0이면 outward. CSS pixel로 deltaMode를 통일한다.
`d_next = clamp(d * exp(-0.00016 * deltaPixels), 0.25, 240)`.
100px 한 입력의 inward 이동은 약 1.59%다. d=40이면 약 .635, d=1이면 약 .016.
이는 기존 위험 점수의 log 변환이 아니라 camera 거리의 비선형 입력 응답이다.
크게 모인 delta도 같은 합산 법칙을 사용한다. 공중 flight가 아니라 선택 pivot로의 접근이며
near bound에 도달하면 멈춘다. 밖에서 wheel은 일반 page scroll로 남긴다.
공식 OrbitControls의 dollyIn/dollyOut을 사용; damping은 orbit 회전에 적용한다.
wheel 자체의 시간 보간/관성은 이번에는 추가하지 않는다. 작은 step과 관성은 다른 개념이다.

Orbit은 Q/C만 바꾼다. target focus는 현재 numeric point만 pivot로 사용한다.
경계 선택은 frame reference를 갱신하고, 명시적 방향 정렬 버튼은 group 방향에서
origin을 보는 관측으로 복귀한다. 갑작스런 target 변경의 smooth transition은 Phase 2.

Zoom hierarchy는 camera distance만으로 자동 확정하지 않는다. selection + projected size
+ explicit detail intent + 자료 존재 여부를 함께 사용한다.
- SYSTEM: 9 group 상태와 reference shells. NQ 상태는 목록에 항상 유지.
- BOUNDARY: 선택축/멤버 정보. group r 없음.
- CONTROL: raw/threshold/r 및 투영 계기.
- ANALYSIS: 승인된 연결 자료를 별도 metric space로 개방. 미승인/누락이면 이유 표시.
- RELATION: 분석 대상/방법/표본/연도가 확인된 relation만, relation inspector로 연결.

Phase 2 LOD는 projected extent와 hysteresis로 전환 flicker를 막는다.
LOD 숨김은 state 삭제가 아니며 distant points의 위험 순위가 달라진 것처럼 보이면 안 된다.

NASA 실제 조작 기록은 RESEARCH.md를 유지한다. target 선택/시야 변화/drag/zoom은
확인했지만 NASA의 정확한 FOV/dolly 함수나 damping 계수는 확인하지 못했다.
NASA의 왼쪽 `from Earth` 숫자는 확대해도 유지됐으므로 camera-target 거리로 복제하지 않는다.
이번 dolly 수식은 NASA 소스 복사가 아니라 공개 OrbitControls 위의 명시적 프로젝트 결정이다.

## 9. Analysis-data integration model

기존 `audit/inventory.json`을 재사용하고 관련 분석 설명/CSV만 표적 재확인했다.
5 chapters와 9 boundaries는 일대일이 아니다. chapter index로 group을 연결하지 않는다.

| 실제 자료 | 의미와 통합 제한 |
|---|---|
| 01 `section_01_analysis/csv/raw_xyz.csv`, `stat_03_association.csv` | 국가 분석/관계 자료. global biosphere/forest/freshwater control 그 자체가 아님. |
| 02 `SECTION_02_ANALYSIS_MATERIAL.md`, `section02_main_01_xy_land_occupation_cultivation.csv` | agricultural/arable land %, n=180, 2023. 원문은 네 개 XY를 주 분석으로 권고. optional XYZ 강제 금지. |
| 03 `SECTION_03_ANALYSIS_MATERIAL.md`, `section03_main_02_xyz_nutrient_chemical_input.csv` | 국가 N/P/pesticide kg/ha와 global Tg/yr 경계는 다른 지표. water stress %와 blue/green water score도 다름. |
| 04 `SECTION_04_ANALYSIS_MATERIAL.md`, `section04_main_01_xy_energy_dependence_co2_output.csv` | 발전 비중 %와 국가 소비기반 CO2 tonnes/person; global atmospheric ppm의 하위 측정값으로 간주 금지. |
| 05 / final `OUTPUT_01_land_marine_kba_XYZ.csv`, `OUTPUT_02_land_renewable_XY.csv` | 보호/대응 coverage와 renewable energy. 대응 지표를 환경 risk score의 역수로 만들지 않음. |

02 문서에 있는 agricultural/arable Spearman .5602518596, Pearson .5428220934,
n=180은 변수쌍/국가 표본의 association이지 두 global boundary의 edge가 아니다.
02 자료의 forest change는 annual net change %, global forest point는 남은 forest 상태 %다.
04 자료는 에너지 2025와 배출 2024가 섞여 있다. chapter의 연도를 global PB timeline으로 전용하지 않는다.

다음 단계 schema: `analysisId, archive, zipMember, sha256, rowKey, variables[{column,
indicator,unit,year}], population, transform, relatedBoundaryIds, linkMeaning,
linkEvidence, reviewStatus`.
CSV의 x/y/z만 보고 축 이름/연도/단위를 추측하지 않는다. metadata/분석 설명을 필수로 붙인다.
final bundle 중복본은 source hash로 deduplicate한다. label이 ISO3가 아닐 경우 새로운 key를
가정하지 않고 source row index와 원본 label을 보존한다.

Local chart는 선택 group의 탐색 맥락에 dock되지만 독립 axes/units/bounds를 가진다.
global p에 로컬 수치를 더해 `p + scale*localXYZ`로 동일 metric처럼 표시하지 않는다.
시각적으로 근처에 놓을 때는 별도 framed tool/viewport와 명시적 provenance가 필요하다.
XY가 더 정확한 관계는 2D를 유지한다. 검증된 XYZ만 local 3D observation 대상으로 허용한다.
이번 최소 수정에서는 local CSV를 global mesh로 생성하지 않는다. crosswalk 승인은 남은 작업이다.

## 10. Edge / relation taxonomy

| Type | 근거 / endpoints | 렌더링 규칙 |
|---|---|---|
| MEASUREMENT | original control ID + source score; origin -> numeric control | 11개 선 유지. 길이 r. 관계/원인/시간선 아님. |
| CONTROL | source chapter/group의 variables membership; control IDs | 의미는 공동 membership만. 현재 목록 grouping으로 표시, 추가 선 없음. NQ endpoint에 가짜 선 금지. |
| ANALYTICAL | source file/rows + named variables + method + coefficient/n/years | 승인된 local analytical variables 사이에서만. correlation은 인과가 아님. 이번 전역 graph 없음. |

edge record는 `id,type,sourceId,targetId,evidence{archive,member,hash,rowOrPath,
method,units,years,n},visibilityPolicy`를 갖도록 한다. 근거 없는 record는 거부한다.
동시에 사용됐다는 근거는 `co-analysis`이지 `correlation`이 아니다.
view-dependent edge visibility/filter는 truth와 별도다. 교차/겹침은 새로운 연결을 생성하지 않는다.

## 11. Why this requires 3D (and where it does not)

1. 실제 환경 정보는 raw/threshold/r와 검증된 분석이다. 9방향/offset은 layout이다.
2. observer-dependent 정보는 projection, sightline angle, depth, overlap, frustum이다.
3. reference축 상대각은 축을 바꿀 때만 변하며 observer motion과 동일하지 않다.
4. relation의 근거는 고정, 화면에 보이는 교차/겹침/가시성만 시점 의존이다.
5. 현재 11개 scalar의 정밀 비교에는 2D list/plot가 충분하며 더 유리하다.
6. 3D가 추가하는 것은 새 환경 변수나 과학적 관계가 아니라 관측 자유도와
   투영의 모호성을 직접 시험할 수 있는 재현 가능한 관측 실험이다.
7. 실제 삼변량 local dataset에서는 세 변수의 구조를 회전 관찰할 이유가 있다.
   이것도 2D projections와 함께 검증해야 하며 현재 global layout과는 다른 metric이다.
8. 단지 점을 입체로 놓고 회전시키면 장식에 머문다. 별/궤도/glow는 제거하고,
   회전은 겹침 해소, 축 재선택은 다른 frame 표현, zoom은 근거 분석 접근 역할만 갖게 한다.

따라서 "환경 정보 자체가 3D를 반드시 요구한다"고 주장하지 않는다.
이번 추천안의 가치는 같은 state를 다른 관측으로 읽어도 state가 불변임을
검증하는 데 있다. 사용성 테스트에서 이 가치가 확인되지 않으면 2D 기본 보기를 우선한다.

## 12. Remaining risks / misleading interpretations

- Fibonacci의 이웃/각거리/점간 Euclidean distance는 생태적 similarity가 아니다.
- 구면의 면적/체적도 위험 총량이 아니다. r=2를 r=1의 8배 위험으로 읽을 수 없다.
- camera depth나 perspective shortening으로 위험 순위를 판단하면 안 된다. 원본 r 목록 유지.
- screen overlap threshold는 관측 display 조건이다. glyph occlusion/증거 edge와 구분.
- data norm 검사만 통과해도 world direction이 변할 수 있어 frozen-coordinate 검사 추가.
- boundary group pivot를 평균으로 만들면 aggregation이므로 금지. origin pivot와 semantic selection 분리.
- local analyses의 국가/연도/단위/표본과 global snapshot의 출처가 다르다. crosswalk 승인 전 결합 금지.
- NQ를 없애거나 r=0에 놓지 않는다. sidebar membership/status는 항상 접근 가능.
- 자동 label collision avoidance로 이동한 label 위치는 projected observation에서 제외한다.
- 실측 temporal dataset의 시간 정합성이 검증되기 전 TIME STATE 없음.
- 원문 천문 도해와 NASA interaction은 개념 참고, 환경 모델의 과학적 증거가 아니다.

## Implementation boundary

Checkpoint: `checkpoints/phase1-before-observer-20261005/` (source + runnable dist).
선정한 B의 최소 검증 기능만 적용한다. 새 환경 데이터, 새 normalization,
global-local analytical edge, timeline, surface, visual polish는 이번 변경 범위가 아니다.
완료 상태와 검증 산출물은 `NEXT_STEPS.md`, `VALIDATION.md`에서 갱신한다.

## Prototype application after visual restore

2026-10-05 재적용 범위는 visual redesign이 아니라 관측 로직 계측이다.
복원된 geometry, point positions, origin-to-point measurement lines, r-orbits,
reference shells, node scale은 유지한다.

적용한 천문 개념은 다음 세 가지로 제한한다.

| 원리 | 앱에서의 계산 | 데이터 보존 규칙 |
|---|---|---|
| 관측자 중심 좌표 | `camera.matrixWorldInverse`로 world point를 camera-local point로 변환 | `control.position`과 `r`은 수정하지 않는다. |
| 기준축/기준면 | 선택 boundary direction으로 `axisFrame()`을 만들고 local XYZ와 axis angle 계산 | group direction은 layout parameter이며 과학적 방위/원인축이 아니다. |
| 투영/겉보기 변화 | camera image plane의 screen x/y, depth, bearing, elevation, overlap list 계산 | 화면 겹침/깊이/방위는 relation이나 risk score가 아니다. |

UI에는 `OBSERVER FRAME / DERIVED` readout과 하단 projected readout을 추가한다.
`DATA STATE`는 `R`과 fixed world XYZ를 표시하고,
`LOCAL FRAME`, `SIGHTLINE`, `DEPTH`, `SCREEN`, `OVERLAP`은 observer-dependent
값으로 분리한다. 카메라 orbit 또는 wheel dolly는 이 derived 값만 바꾼다.

이 변경으로 사용자가 테스트할 수 있는 핵심 명제:

1. 같은 node를 선택한 채 회전하면 `BEARING / ELEVATION / SCREEN / DEPTH`가 바뀐다.
2. 같은 회전에서 `R`과 validation의 `WORLD |position|`은 바뀌지 않는다.
3. `ALIGN GROUP`으로 reference axis를 바꾸면 local frame readout이 바뀐다.
4. NQ boundary/control은 direction context는 있지만 `NO XYZ`로 남는다.

향후 이 readout은 NASA Eyes식 깊이 navigation이나 local analysis layer를 붙일 때
좌표계 전환을 설명하는 계기판 역할을 한다. 아직 시간축, 가짜 orbit animation,
국가/관측값 star field, analytical edges는 추가하지 않는다.
