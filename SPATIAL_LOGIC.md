# Spatial logic: Phase 1 implementation

작성일: 2026-10-04. 후속 사용자 결정으로 aggregation 없는 9개 그룹·11개 정량점·2개 비정량 상태를 구현했다. 아래 A~E 비교를 유지하며 외부 reference 조작·소스 조사를 마친 뒤 C를 최종 채택했다. 구현은 src/data.js, src/spatial.js, src/main.js에 있다.

## 변환 계약

```text
different units
 -> existing riskScore logic, with risk direction correction
 -> per-control unified distance (not a boundary aggregate)
 -> r = that same distance
 -> theta / phi = explicit, stable spatial layout parameters
 -> XYZ
 -> control point
 -> origin-to-point measurement connection
 -> future surface: topology and interpretation must be decided separately
```

정성적 멸종률과 미확정 신규 물질은 정량 파이프라인에 통과시키지 않는다. Qualitative score=3을 정량 관측으로 승격하지 않는다. 11개 정량점은 8개 boundary에 속하며 9번째 boundary인 신규 물질에도 그룹·방향·라벨·선택·inspector는 존재한다. 비정량 두 변수는 r/XYZ=null이며 점과 측정선은 생성하지 않는다.

정밀도는 기존 계산의 동일 재현을 채택했다. 원본 계산 함수와 full-precision 결과가 같고 SVG 4자리 출력과도 일치함을 검증했다. 반올림된 SVG 값을 geometry 입력으로 사용하는 대신 원래 계산 결과를 사용한다. 기존 함수를 재현하는 것과 새로운 척도로 재정규화하는 것은 구별하며, 원점까지 거리는 원래 수치 그대로다.

## 각도 배치 비교

모든 안에서 단위 방향 벡터에 원래 r만 곱하면 원점까지 거리는 보존된다. 깊이를 좌표에 단순 가산하거나 XYZ 성분을 개별 rescale하면 이 계약을 깨뜨린다. 원근 투영된 화면 거리는 r과 다르므로 정확한 비교에는 inspector 수치를 병기해야 한다.

| 안 | r 보존 | 순서·연결·시간/인과 오해 | 9개 비교 | Zoom-in | 변환 설명 |
| --- | --- | --- | --- | --- | --- |
| A. 평면상 동일 각도 간격 | 단위 원 방향 사용 시 보존 | 인접 순서에 관계가 있다는 인상을 줌. 폐곡선은 radar profile로 보일 수 있음 | 정면에서는 가장 쉬움; 옆에서 겹침 | 가능하지만 공간 깊이는 없음 | 매우 쉬움; 평면 기준 대조안에 적합 |
| B. 고정 방위각 + 깊이 변화 | 깊이를 phi로 바꿔 단위화할 때만 보존 | 깊이가 위험·서열·시간인 것처럼 보이기 쉬움 | 깊이 겹침과 단축으로 비교 불리 | 접근 가능하나 중첩 주의 | 임의 깊이를 설명하기 어려움 |
| C. Fibonacci sphere | 고정 단위 방향 사용 시 보존 | 자연스러운 인접 순서가 없으므로 점 사이 연결의 근거가 없음 | 퍼짐은 좋으나 앞뒤 겹침·원근 영향, 회전 필요 | 대상별 접근에 적합 | 재현 가능한 배치로 설명 가능; 과학적 각도가 아님 |
| D. 프로젝트/챕터 순서 radial arrangement | 단위 방향 사용 시 보존 | 편집 순서를 명시할 수 있으나 연결하면 단계·진행으로 읽힐 위험 | 정면 비교 좋음; 완전 3D화할 이유는 별도 필요 | 챕터 접근과 잘 연결됨 | 기존 order가 근거이나 시간·인과가 아님을 구분해야 함 |
| E. Data-driven theta/phi | 각도 변환 후 r 유지 시 보존 | 과학적 관계를 암시하므로 변수·모델 근거 필요 | 실제 변수 분포에 따라 달라짐 | 실제 의미가 있다면 유리 | 현재 9개 boundary에 대응하는 각도용 데이터가 없어 채택 불가 |

## 최종 선택: C + 원점에서 각 점으로 연결

**고정 Fibonacci 방향**을 채택했다. A/D는 정면 비교가 쉽지만 평면 배치이고, B는 임의 깊이에 의미를 붙이기 쉬우며, E에는 각도를 정할 실제 데이터가 없다. C는 9개 그룹의 구면 분산과 대상 접근에 적합하며 각도를 데이터와 분리해 재현하기 쉽다. 근사 균등 분포이지 모든 쌍의 각도가 동일하다는 뜻은 아니다. GROUP_IDS에 고정된 chapter ID 순서를 사용하므로 입력 chapter 배열을 정렬하거나 관측값을 바꾸어도 그룹 방향은 변하지 않는다.

9개 슬롯에서 i=0..8, y=1-2*(i+0.5)/9, theta=i*pi*(3-sqrt(5)), x=sqrt(1-y*y)*sin(theta), z=sqrt(1-y*y)*cos(theta)로 unit direction을 만든다. 각도·위도처럼 보이는 값은 전부 layout이며 과학적 위치가 아니다.

단일 변수는 그룹 방향을 그대로 사용한다. 두 변수는 원본 variables 배열 순서에 따라 -3°/+3°를 사용한다. 그룹 방향 d와 Y축에 직교하는 unit tangent t로 u=normalize(cos(offset)*d+sin(offset)*t)를 만든다. Offset은 위험도와 무관하고 방향 길이는 1이다. 변수 배열 순서도 현재 데이터 계약이며 순서 변경 시 슬롯 정책을 명시적으로 검토해야 한다. 그룹 중앙에 수치 대표점을 만들지 않는다.

그룹 라벨은 HTML overlay이며 d*3.25를 화면 투영한 위치를 초기 anchor로 사용한다. 3.25는 라벨 배치 상수일 뿐 r이나 관측 좌표로 저장하지 않는다. 겹침 회피와 viewport 제한에 의해 라벨이 이동할 수 있고, tooltip과 그룹 inspector에 대표 r이 없음을 표시한다. 특히 NQ 라벨은 점선·황색 상태로 항상 유지한다. 라벨 anchor에는 3D Mesh나 origin 측정선을 만들지 않는다. 따라서 NQ에 거짓 radial data position이 없다.

**Origin → 각 quantitative control point** 측정선 11개만 생성한다. 선분 길이는 해당 변수의 데이터 거리이며 boundary 간 상관·인과·시간 경로를 나타내지 않는다. Boundary끼리의 연결 순서는 존재하지 않는다.

## XYZ 및 검증 계획

Three.js의 Y-up 관례를 가정한다. theta는 +Z에서 +X로 향하는 방위각, phi는 +Y에서 내려오는 극각이며 단위는 radians다. 이는 천문·지리 관측각이 아니다.

```text
x = r * sin(phi) * sin(theta)
y = r * cos(phi)
z = r * sin(phi) * cos(theta)
sqrt(x*x + y*y + z*z) = r
```

원점과 데이터 점을 담는 scene group에 배율을 적용하지 않는다. Reference geometry는 r=1, r=2인 구면의 wireframe 또는 great circles로 만들 수 있다. 카메라 범위를 큰 r에 맞추며 데이터 자체를 축소·cap하지 않는다.

Double precision 좌표 검증: `abs(hypot(x,y,z)-r) <= 1e-10 * max(1,abs(r))`. Float32 선분 끝점은 `2e-7 * max(1,abs(r))` 허용 오차를 적용한다. 실제 Mesh world position, 원점, 선분 시작/끝과 Mesh 중심 일치도 runtime에서 검증한다. 음수·NaN·무한대·잘못된 벡터는 실패이며 null을 0으로 바꾸지 않는다. r/position이 둘 다 null인 비정량 상태만 NOT QUANTIFIED다. 현재 11/11 PASS이며 validation/에 결과를 저장했다.

Inspector에 요청된 전체 필드와 출처·정량/정성 상태를 제공한다. `DATA DISTANCE = r`은 고정 데이터이며 `OBSERVATION DISTANCE = OrbitControls.getDistance()`는 가변 interaction state다. 카메라 zoom/orbit/focus 전후 XYZ 불변을 브라우저에서 검증했다. Perspective FOV=50, minDistance=.25, maxDistance=90, dampingFactor=.07이다. 데이터 group scale은 1이며 fit은 카메라만 조절한다.

## Surface 제한

임의 방향으로 배치한 점의 convex hull이나 삼각면은 물리적 Earth-system 경계가 아니다. 내부 면적·부피도 검증된 종합 위험 지표가 아니다. 향후 surface 생성에는 topology, 결측 처리, 각도 배치 의존성에 관한 별도 결정이 필요하다.
