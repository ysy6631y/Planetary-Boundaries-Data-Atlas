# Local data audit

작성일: 2026-10-04. 아래 내용은 최초 로컬 감사 시점의 기록이다. 이후 사용자가 9개 그룹·11개 정량점·2개 비정량 상태로 구현을 승인하여 중단 조건을 해소했다. 원본 및 기존 audit/ 결과는 변경하지 않았다.

후속 구현: aggregation 없이 기존 정량 riskScore를 전체 정밀도로 재현하고 원본 계산 코드 및 SVG score와 대조했다. Genetic Diversity와 Novel Entities는 r/XYZ=null로 유지한다. 최신 상태는 SPATIAL_LOGIC.md, VALIDATION.md, NEXT_STEPS.md를 참고한다. 아래의 미실행·보류 표기는 최초 감사 당시를 뜻한다.

## 결론

사용자가 명시한 중단 조건에 해당한다. 9개 boundary에 13개 control variable이 있으며, 4개 boundary에 각각 2개 변수가 있다. Boundary별 단일 통합 distance는 없다. Aggregation, 새로운 normalization, XYZ 생성은 수행하지 않았다.

정량 관측 11개, 정성적 상태 1개, 정량 경계 미확정 1개다. 현재 자료만으로 9개의 정확한 boundary 대표점을 만들 수 없다.

## 읽은 파일과 원본 보존

7개 ZIP 전체의 파일 구조를 조사하고 CSV 115개, 헤더 제외 총 260,650행을 파싱했다. 이 수는 bundle 내 중복본을 포함한 파일별 행 수의 합이며 독립 관측 수가 아니다. 모든 CSV의 열 개수 불일치 행은 0개다. 이것은 구문 검증이며 과학적 정확성 검증은 아니다.

| ZIP | CSV 수 | 역할 |
| --- | ---: | --- |
| 01_maintaining_systems.zip | 11 | 국가별 유지 시스템 원자료와 분석 |
| 02_land_transformation.zip | 21 | 국가별 토지 전환 원자료와 분석 |
| 03_resource_pressure.zip | 21 | 국가별 자원 압력 원자료와 분석 |
| 04_atmospheric_pressure.zip | 18 | 국가별 대기 압력 원자료와 분석 |
| 05_maintenance_and_response.zip | 10 | 국가별 보호 및 대응 원자료 |
| final_csv_bundle.zip | 34 | 챕터별 선택된 국가 비교·통계 결과 |
| 단위 통합 거리화.zip | 0 | 9개 PB의 JSON, 계산 코드, SVG |

실제 파일명, 실제 CSV 컬럼 전체, 행 수: [audit/INVENTORY.md](audit/INVENTORY.md).
ZIP 엔트리 원문, 복원한 경로, SHA-256, 컬럼별 빈 셀 수, 샘플: [audit/inventory.json](audit/inventory.json).

ZIP을 추출하거나 내부 파일을 수정하지 않고 읽었다. 감사 전후 7개 ZIP의 SHA-256이 동일하다. 원본 JSON과 JS는 감사용 별도 경로에 바이트 그대로 복사했다. macOS 메타데이터는 목록만 기록하고 분석 대상에서 제외했다. 일부 ZIP의 UTF-8 파일명이 CP437로 표시되어 표시 경로만 복원했으며 ZIP 자체는 수정하지 않았다.

## 거리화 ZIP의 실제 구조

```text
챕터 도표/
  index.html
  data/planetary-boundaries.json
  scripts/generate.js
  svg/01-climate-change.svg
  svg/02-biosphere-integrity.svg
  svg/03-land-system-change.svg
  svg/04-freshwater-change.svg
  svg/05-biogeochemical-flows.svg
  svg/06-ocean-acidification.svg
  svg/07-atmospheric-aerosol-loading.svg
  svg/08-stratospheric-ozone-depletion.svg
  svg/09-novel-entities.svg
```

CSV는 없으므로 해당 ZIP의 CSV 컬럼도 없다. JSON 루트는 `meta`, `chapters`다.

- Chapter 필드: `id`, `order`, `title_ko`, `title_en`, `control_note`, `pb_note`, `variables`.
- Variable 필드: `id`, `label`, `control_label`, `unit`, `direction`, `baseline`, `boundary`, `high_risk`, `current`, `data_status`, `source_ids`.
- 정성적 멸종률에만 `qualitative_position`이 추가된다.
- `raw_value`, `normalized_distance`, `unified_distance`, boundary 대표 distance 필드는 없다.
- Raw/current 값은 `current`; planetary boundary 값은 `boundary`다.
- 방향은 `higher_is_worse`와 `lower_is_worse`로 저장되어 있다.
- `meta.basis_year`는 문자열 `2025`다. 개별 변수마다 별도의 관측 연도 필드는 없다.
- `source_ids`는 원본의 출처 선언이다. 이번 단계에서 외부 출처의 수치까지 독립 검증한 것은 아니다.

## 13개 제어변수와 기존 score

다음 score는 새로 계산한 값이 아니라 기존 SVG의 `data-score` 문자열이다. 생성 코드가 `toFixed(4)`로 저장하므로 소수점 4자리로 반올림된 결과다. 내부 전체 정밀도와 동일하다고 주장하지 않는다.

| Boundary | Indicator ID | current | unit | baseline | boundary | high_risk | direction | SVG score |
| --- | --- | ---: | --- | ---: | ---: | ---: | --- | ---: |
| Climate change | co2 | 423 | ppm | 280 | 350 | 450 | higher_is_worse | 1.7300 |
| Climate change | radiative-forcing | 2.97 | W/m² | 0 | 1 | 1.5 | higher_is_worse | 4.9400 |
| Biosphere integrity | genetic-diversity | null | E/MSY | 1 | 10 | 100 | higher_is_worse | 3.0000 (정성 표시) |
| Biosphere integrity | hanpp | 30 | % | 0 | 10 | 20 | higher_is_worse | 3.0000 |
| Land-system change | forest-cover | 59 | % | 100 | 75 | 54 | lower_is_worse | 1.7619 |
| Freshwater change | blue-water | 18.2 | % | 10.3 | 12.9 | 50 | higher_is_worse | 1.1429 |
| Freshwater change | green-water | 15.8 | % | 9.8 | 12.4 | 50 | higher_is_worse | 1.0904 |
| Biogeochemical flows | phosphorus | 18.2 | Tg P/yr | 0 | 6.2 | 11.2 | higher_is_worse | 3.4000 |
| Biogeochemical flows | nitrogen | 190 | Tg N/yr | 0 | 62 | 82 | higher_is_worse | 7.4000 |
| Ocean acidification | aragonite-saturation | 2.84 | Ωarag | 3.57 | 2.86 | 2.5 | lower_is_worse | 1.0556 |
| Atmospheric aerosol loading | aod-difference | 0.063 | AOD | 0.04 | 0.1 | 0.25 | higher_is_worse | 0.3833 |
| Stratospheric ozone depletion | ozone | 285.7 | DU | 292 | 277.4 | 261 | lower_is_worse | 0.4315 |
| Novel entities | untested-chemicals | null | % | 0 | 0 | null | higher_is_worse | 없음 |

원본 필드와 SVG score를 대응시킨 기계 판독 기록: [audit/controls.json](audit/controls.json). `score_text` 등은 감사 결과의 필드이며 원본 JSON 컬럼이 아니다.

## 기존 normalization의 실제 동작

[audit/generate.source.js.txt](audit/generate.source.js.txt)의 `riskScore()`를 직접 읽었다. 정량 변수는 baseline→boundary를 0→1, boundary→high risk를 1→2로 구간별 선형 변환한다. High risk 밖에서는 두 번째 구간의 기울기로 외삽한다. 감소형은 차이의 방향을 반대로 사용한다. Baseline보다 안전한 값은 0으로 clamp하는 기존 정책이 있다.

별도 함수 `qualitativeScore()`가 `beyond_high_risk`를 정확히 `3`에 배치한다. 따라서 멸종률의 `3.0000`은 관측값으로 계산한 정확한 위험 거리가 아니다. `label`의 `>100`도 정확한 current로 바꾸지 않는다. HANPP의 같은 `3.0000`과 증거 성격이 다르다.

`xFromScore()`는 38/96/132/176으로 별도 시각 배치를 수행하며 high-risk 초과 영역은 chapter 내 `maxScore`에 의존한다. 다른 chapter에서 같은 x가 같은 위험 거리를 뜻하지 않는다. 원본 SVG는 mm 기반 viewBox 좌표를 사용한다. 사용자 지시의 핵심대로 이 숫자들은 UI 배치 좌표이며 3D 데이터 거리가 아니다.

`visibleMarkers()`의 `Math.max(3, ...scores)`는 화면 범위 설정이다. Boundary 대표 distance를 max aggregation한 코드가 아니다.

정량 distance의 이후 정밀도 정책은 기존 `riskScore` 로직의 동일 재현을 우선 제안한다. SVG의 반올림 score와 대조하여 검증하고, 새로운 normalize나 cap을 추가하지 않는다. 이번 감사에서는 해당 함수를 실행하거나 재계산하지 않았다.

## 다른 ZIP의 XYZ와 혼동하지 않을 것

원자료의 대표 컬럼은 `Entity, Code, Year, <지표명>`이며 processed 데이터는 `iso,value`다. 분석 CSV는 주로 `x,y,label` 또는 `x,y,z,label`이다. 이 x/y/z는 서로 다른 국가별 지표값이나 통계 결과다. 공통 PB 위험 거리 또는 지리 공간 좌표가 아니다.

예를 들어 국가별 토지 면적 대비 산림 비율과 PB의 원래 산림 대비 잔존율은 같은 변수가 아니다. CO₂ 배출량/인과 대기 CO₂ ppm도 다르다. 국가 데이터로 빠진 전 지구 PB 값을 대체할 근거가 없다. 이 파일들에서 9개 PB의 각도를 결정할 공통 변수·명시적 연결 관계도 확인하지 못했다.

## Aggregation 대안과 결정 필요 사항

| 전략 | 의미와 장점 | 손실과 한계 |
| --- | --- | --- |
| 집계하지 않고 9개 그룹·제어변수별 점 유지 (권장) | 원래 score와 지표 차이를 보존하고 raw→geometry 추적 가능 | 9개 수치점 조건을 바꿔야 함. 11개 정량점과 2개 비정량 상태로 구성 |
| Boundary 내 max | 가장 큰 정량 초과를 대표; 작은 값에 가려지지 않음 | 다른 지표를 숨김. 서로 다른 기울기의 score 중 최댓값이라는 선택이며 공식 종합 위험으로 볼 수 없음. 정성·결측은 해결되지 않음 |
| 단순 평균 | 그룹 내부 수치의 중심을 하나로 표시 | 보상 관계와 같은 가중치를 가정해 심한 초과를 희석. 결측 제외 시 집계 대상도 달라짐 |
| 가중 평균 | 외부 근거가 있는 중요도를 반영 가능 | 현재 가중치 근거 없음. 가중치가 결과를 좌우하며 초과 희석 가능 |
| 합산 | 모든 지표의 수치 크기를 누적 | 지표 수에 따라 증가. 합산 후 1=PB, 2=high risk가 유지되지 않아 본 설계에 부적합 |
| 대표 지표 하나 선택 | 원지표 distance를 바꾸지 않고 1개 점 표시 | Boundary 전체를 대표한다는 근거 필요. 나머지 지표를 생략하며 신규 물질 문제도 남음 |

어떤 전략도 실행하지 않았다. 권장안은 **9개 boundary 그룹을 유지하면서 11개 정량 control point를 표시하고, 멸종률과 신규 물질은 정확한 r 없이 별도 상태로 보존**하는 것이다. 멸종률의 범주 표시를 실제 r=3 관측점으로 바꾸거나 신규 물질에 r=0을 넣지 않는다.

9개 대표 수치점이 반드시 필요하다면 aggregation 정책뿐 아니라 정성값과 미확정 경계를 처리할 근거 있는 정책·추가 자료가 필요하다.

## 재현

```sh
python3 scripts/audit_data.py
```

Python 표준 라이브러리만 사용한다. `audit/`의 감사 산출물만 다시 쓰며 원본 ZIP/CSV는 수정하지 않는다. 현재는 감사 도구만 존재하며 웹 프로토타입은 구현하지 않았다.
