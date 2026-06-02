# ADDFCS.COM 서비스 상세 README

ADDFCS.COM은 주의, 집중, 실행 기능과 관련된 일상 패턴을 사용자가 직접 점검하고, 짧은 반응성 과제를 통해 실제 수행 패턴을 함께 확인하는 모바일 웹 앱 프로토타입입니다. 이 서비스는 의학적 진단 도구가 아니며, 사용자의 자기보고와 수행 데이터를 결합해 현재 보이는 경향을 이해하기 쉽게 정리하고 작은 실행 계획으로 이어 주는 자기점검 보조 도구입니다.

서비스의 핵심은 "스스로 느끼는 어려움"과 "짧은 과제에서 실제로 나타난 반응"을 나란히 놓고 비교하는 것입니다. 사용자가 설문에서 보고한 집중 유지, 미루기, 충동적 반응, 안절부절함 같은 주관적 경험과, 반응성 과제에서 측정된 목표 놓침, 잘못된 반응, 반응시간 변동성, 움직임 안정성 같은 객관적 수행 지표를 통합해 리포트와 계획을 생성합니다.

## 1. 서비스 한 줄 요약

ADDFCS.COM은 간단 자기점검, 세부 자기점검, 반응성 과제 3종, 통합 리포트, 실행 계획, AI 계획 조정 채팅, DTx 숲 허브, 목표 체크 게임, 구조도 맵을 포함한 주의·집중·실행 기능 패턴 자기점검 웹 서비스입니다.

## 2. 현재 구현된 전체 사용자 흐름

현재 메인 앱은 단일 페이지 앱처럼 동작하며, 사용자는 아래 흐름을 따라갑니다.

1. `INTRO`: 서비스 소개 화면
2. `ID`: 새 ID 생성 또는 기존 기록 불러오기
3. `HUB`: 현재 기록 상태와 진행 가능한 검사/리포트 진입
4. `SELF`: 간단 자기점검 6문항
5. `SELF RESULT`: 간단 자기점검 결과와 AI/로컬 요약
6. `SYM`: 세부 자기점검 23문항
7. `SYM RESULT`: 세부 자기점검 결과와 AI/로컬 요약
8. `REACT`: 반응성 과제 3종
9. `RESULT`: 설문과 반응성 과제를 통합한 패턴 리포트
10. `PLAN`: 유형별 실행 계획 3개와 AI 조정 채팅
11. `DTx`: 숲 형태의 후속 행동 허브
12. `plangame`: 실행 계획을 목표 카드로 바꾸어 체크하는 실험 화면
13. `/map`: JSON, 파생 지표, AI 입력 흐름을 시각화한 구조도 화면

하단 네비게이션은 현재 단계 표시와 완료 후 리뷰 용도로 쓰이며, 기본 진행 중에는 사용자가 중간 단계를 임의로 건너뛰지 않도록 제한되어 있습니다.

## 3. 기술 스택

### 서버

- Node.js 기본 `http` 모듈 기반 서버
- 별도 Express 의존성 없이 `server.js`에서 정적 파일 제공, API 라우팅, JSON 저장, AI 호출을 직접 처리
- `.env` 파일 수동 로딩
- 로컬 파일 시스템 기반 JSON 데이터베이스
- Gemini API 연동

### 프런트엔드

- 정적 HTML, CSS, JavaScript
- `public/index.html`과 `public/app.js` 중심의 SPA 방식 렌더링
- Tailwind CDN과 자체 CSS 변수 기반 테마 적용
- 모바일 우선 UI
- 반응성 과제는 브라우저 이벤트, 터치, 포인터, 디바이스 모션/오리엔테이션 API를 사용

### 데이터 저장

- `database/*.json` 파일에 사용자별 기록 저장
- 파일명 형식: `<id>-<timestamp>.json`
- 예: `test01-20260531-153012.json`

### AI

- Gemini API
- 기본 모델: `gemini-2.5-flash`
- 환경 변수:
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL`

## 4. 실행 방법

```bash
npm install
npm start
```

기본 서버 주소:

```text
http://127.0.0.1:3333
```

네트워크 접속용 실행 스크립트:

```bash
./run.sh
```

서버 중단:

```bash
./end.sh
```

`.env` 예시:

```env
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-2.5-flash
HOST=0.0.0.0
PORT=3333
```

## 5. 주요 디렉터리 구조

```text
.
├── server.js
├── package.json
├── README.md
├── newreadme.md
├── config/
│   ├── asrs.json
│   ├── dsm-5.json
│   └── report.json
├── database/
│   └── <user-record>.json
├── designmd/
│   └── DESIGN-*.md
├── game/
│   ├── images/
│   ├── scripts/
│   ├── test1/
│   ├── test2/
│   └── test3/
├── public/
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   ├── dtx/
│   ├── plangame/
│   ├── map/
│   ├── game/
│   ├── test1/
│   ├── test2/
│   └── test3/
├── dsm5/
├── asrs/
├── react/
├── plan/
├── report/
├── paper/
└── 참고논문/
```

## 6. 서버 구현 상세

서버의 중심 파일은 `server.js`입니다. 이 파일은 아래 책임을 모두 가집니다.

- `.env` 읽기
- 정적 파일 제공
- 이미지/게임 스크립트/디자인 파일 제공
- 사용자 기록 저장 및 불러오기
- 지도 레이아웃 저장 및 불러오기
- 디자인 테마 목록과 개별 테마 제공
- 설문/반응성 과제 데이터를 기반으로 지표 계산
- 결정론적 리포트 생성
- Gemini API 호출
- AI 응답 JSON 파싱 및 fallback 처리

### 6.1 정적 파일 제공

`serveStatic()` 함수는 요청 경로에 따라 다른 디렉터리를 기준으로 파일을 제공합니다.

- `/`: `public/index.html`
- `/images/*`: `images/`
- `/newimages/*`: `newimages/`
- `/dsmimages/*`: `dsmimages/`
- `/game/images/*`: `game/images/`
- `/game/scripts/*`: `game/scripts/`
- `/test1/images/*`, `/test1/events/*`: `game/test1/`
- `/test2/images/*`, `/test2/events/*`: `game/test2/`
- `/test3/images/*`, `/test3/events/*`: `game/test3/`
- 그 외: `public/`

경로 탐색 공격을 막기 위해 `safeJoin()`으로 base directory 밖으로 나가는 경로를 차단합니다.

### 6.2 주요 API

```text
GET  /api/config/:fileName
GET  /api/records
GET  /api/records/:fileName
POST /api/records
GET  /api/design-themes
GET  /api/design-themes/:slug
GET  /api/map-layout
POST /api/map-layout
GET  /api/ai/status
POST /api/ai/asrs-analysis
POST /api/ai/dsm-analysis
POST /api/ai/react-analysis
POST /api/ai/insights
POST /api/ai/chat
```

### 6.3 데이터 저장 원칙

사용자 기록은 `database` 폴더의 JSON 파일로 저장됩니다. `saveRecord()`는 새 기록을 저장할 때 기존 기록의 일부 후속 상태를 보존합니다.

보존 대상:

- `dtx`
- `planGame`
- `tutorials`

또한 `researchUsage`는 단순 덮어쓰기 대신 세션별 활동 로그를 병합합니다. 같은 `sessionId`가 있으면 활동 목록을 합치고, 마지막 활동 시각과 체류 시간을 최신 값으로 보정합니다.

## 7. 프런트엔드 구현 상세

프런트의 중심 파일은 `public/app.js`입니다. 별도 프레임워크 없이 상태 객체와 렌더 함수 기반으로 화면을 전환합니다.

### 7.1 주요 상태

전역 `state`에는 대략 아래 값들이 들어갑니다.

- 현재 route
- 현재 사용자 기록
- 전체 record 목록
- 설정 JSON
- AI 설정 상태
- 디자인 테마 상태
- 게임 런타임 상태
- 모달 상태
- 진행/대기 상태

### 7.2 라우팅

브라우저의 URL 쿼리로 shortcut 진입을 지원합니다.

예:

```text
/?route=report&id=test01
/?route=plan&id=test01
/?shortcut=reactivity&test=go_nogo&id=test01
/?shortcut=reactivity-result&test=balance_hold&id=test01
/?theme=bmw-m
```

내부 route는 `intro`, `id`, `hub`, `asrs`, `asrs-result`, `dsm`, `dsm-result`, `game`, `report`, `plan`, `dtx` 등으로 관리됩니다.

### 7.3 렌더링 방식

`render()` 함수가 현재 route에 맞는 page 함수를 호출하고, 결과 HTML 문자열을 `#app`에 삽입합니다. 게임 화면은 시간 민감 이벤트가 많기 때문에 별도 `gameUi` 상태와 `renderGameUi()`를 사용해 부분적으로 관리합니다.

## 8. 데이터 모델

사용자 기록 JSON은 서비스 전체의 중심입니다.

대표 구조:

```json
{
  "id": "test01",
  "createdAt": "ISO",
  "updatedAt": "ISO",
  "fileName": "test01-YYYYMMDD-HHMMSS.json",
  "currentStep": "hub",
  "tests": {
    "asrs": {},
    "dsm5": {},
    "game": {}
  },
  "asrsAnalysis": {},
  "dsm5QuickAnalysis": {},
  "reactivityAnalysis": {},
  "report": {},
  "plan": {
    "suggestions": [],
    "chat": []
  },
  "dtx": {},
  "tutorials": {},
  "planGame": {},
  "researchUsage": {
    "version": 1,
    "sessions": []
  }
}
```

### 8.1 `tests.asrs`

간단 자기점검 결과입니다.

주요 값:

- `responses`: 0~4 척도 응답 배열
- `attention_score`: 집중 유지 관련 점수
- `attention_max`: 집중 유지 최대점
- `hyperactivity_score`: 반응 조절 관련 점수
- `hyperactivity_max`: 반응 조절 최대점
- `total_score`
- `total_max`
- `positive_count`

### 8.2 `tests.dsm5`

세부 자기점검 결과입니다.

주요 값:

- `responses`: Yes/No 배열
- `inattention_true_count`
- `hyperactivity_true_count`
- `contextual_true_count`
- `total_true_count`
- `subtype`

### 8.3 `tests.game`

반응성 과제 3종 결과입니다.

주요 하위 키:

- `signal_detection`
- `go_nogo`
- `balance_hold`

### 8.4 `report`

통합 리포트 결과입니다.

주요 값:

- `schemaVersion`
- `generatedAt`
- `severity`
- `scores`
- `sections`
- `hero`
- `crossCheck`
- `profile`
- `dailyImpact`
- `bridge`

### 8.5 `plan`

실행 계획과 채팅 기록입니다.

주요 값:

- `suggestions`: 기본 실행 계획 3개
- `chat`: AI 계획 조정 대화 내역

### 8.6 `researchUsage`

연구/사용성 분석용 세션 로그입니다.

주요 값:

- `sessionId`
- `connectedAt`
- `lastActivityAt`
- `durationMs`
- `userAgent`
- `viewport`
- `activities`

## 9. SELF: 간단 자기점검

간단 자기점검은 `config/asrs.json`을 사용합니다.

### 9.1 문항 구성

- 총 6문항
- 최근 6개월 기준
- 0~4 척도
- 각 문항에 실제 일상 예시 제공

척도:

```text
0 전혀 그렇지 않다
1 드물게 그렇다
2 가끔 그렇다
3 자주 그렇다
4 매우 자주 그렇다
```

### 9.2 내부 해석 기준

문항별 기준은 서로 다릅니다.

- 1~3번: 2점 이상이면 유의미 응답
- 4~6번: 3점 이상이면 유의미 응답

파생 변수:

- `totalPositive`: 기준 이상 문항 수
- `attentionPositive`: 집중 유지 관련 기준 이상 문항 수
- `hyperPositive`: 반응 조절 관련 기준 이상 문항 수
- `severity`: 화면용 간단 강도 라벨

### 9.3 이론적 의미

이 단계는 사용자가 일상에서 주관적으로 경험하는 어려움을 수집합니다. 자기보고식 문항은 실제 생활 맥락을 반영하기 좋지만, 기억 편향, 현재 기분, 수면 상태, 스트레스에 영향을 받을 수 있습니다. 그래서 이 서비스는 자기보고만으로 결론을 내리지 않고, 이후 반응성 과제의 수행 지표와 교차 확인합니다.

## 10. SYM: 세부 자기점검

세부 자기점검은 `config/dsm-5.json`을 사용합니다.

### 10.1 문항 구성

- 총 23문항
- Yes/No 응답
- 1~9번: 부주의
- 10~18번: 과잉행동/충동성
- 19~23번: 추가 확인

### 10.2 내부 해석 기준

- 부주의 9문항 중 Yes 6개 이상: 집중 유지 부담 패턴
- 과잉행동/충동성 9문항 중 Yes 6개 이상: 반응 조절 부담 패턴
- 두 영역 모두 6개 이상: 복합 실행 기능 패턴
- 두 영역 모두 6개 미만: 큰 부담 낮음 또는 무증상 범위
- 추가 확인 문항은 기간, 발달력, 여러 환경에서의 반복, 기능 저하, 다른 요인 가능성을 보강합니다.

### 10.3 이론적 의미

이 단계는 DSM-5의 증상군 구조에서 아이디어를 가져오지만, 서비스는 진단을 수행하지 않습니다. 구현상 핵심은 부주의 영역과 과잉행동/충동성 영역의 신호가 어디에 더 모이는지 정리하는 것입니다. 추가 확인 문항은 단순 빈도만이 아니라 지속성, 맥락성, 기능 영향, 대체 설명 가능성을 같이 보려는 장치입니다.

## 11. REACT: 반응성 과제 3종

반응성 과제는 설문과 달리 짧은 수행 상황에서 실제 행동 데이터를 수집합니다.

현재 순서:

```text
signal_detection -> go_nogo -> balance_hold
```

사용자가 진행 중 특정 과제만 골라 건너뛰는 흐름은 기본적으로 제한되어 있습니다.

## 12. 과제 1: 신호 찾기

### 12.1 목적

신호 찾기는 목표 자극을 놓치지 않는지, 반응시간이 얼마나 안정적인지, 시간이 지나며 집중이 떨어지는지를 확인하는 과제입니다.

### 12.2 구현

- 연습 6회
- 본 시행 60회
- 목표 자극에만 반응
- 자극 시간 500ms
- ISI 1000/1250/1500ms 랜덤
- 100ms 미만 반응은 anticipatory로 처리

### 12.3 저장 지표

- `target_count`
- `hit_count`
- `omission_errors`
- `omission_rate`
- `mean_reaction_time`
- `reaction_time_variability`
- `tau`
- `late_phase_drop`
- `anticipatory_count`

### 12.4 주요 이론

이 과제는 지속주의와 신호탐지 과제의 아이디어를 사용합니다.

- `omission_rate`: 눌러야 할 목표를 놓친 비율입니다. 높을수록 목표 탐지나 지속주의가 흔들렸을 가능성을 보조적으로 봅니다.
- `reaction_time_variability`: 반응시간의 표준편차 또는 흔들림 정도입니다. 평균이 같더라도 변동성이 크면 집중 상태가 일정하지 않았을 수 있습니다.
- `tau`: ex-Gaussian 관점에서 느린 반응 꼬리의 폭을 나타내는 개념입니다. 일부 반응이 매우 늦어지는 패턴을 포착하는 데 사용됩니다.
- `late_phase_drop`: 후반부 수행 저하입니다. 과제 시간이 지나며 정확도가 떨어지는지 확인합니다.

이 서비스는 이 값을 "부주의 확정"이 아니라 "집중 유지 관련 보조 신호"로만 사용합니다.

## 13. 과제 2: 멈춤 버튼

### 13.1 목적

멈춤 버튼은 눌러야 할 때 누르고, 멈춰야 할 때 멈추는 반응 억제 능력을 보조적으로 확인합니다.

### 13.2 구현

- 연습 8회
- 본 시행 50회
- `o.gif`: Go 자극, 눌러야 함
- `x.gif`: No-Go 자극, 누르지 않아야 함
- 자극 시간 500ms
- ISI 800/1000/1200ms 랜덤
- Go 성공 기준: 자극 시작 후 220ms 이후부터 자극 종료 전까지
- Apple touch device 보정: 380ms
- No-Go는 최소 2회 이상 Go 뒤에 나오도록 완화

### 13.3 저장 지표

- `go_count`
- `nogo_count`
- `go_hit_count`
- `commission_errors`
- `commission_rate`
- `fast_error_rate`
- `mean_go_reaction_time`
- `premature_response_count`

### 13.4 주요 이론

이 과제는 Go/No-Go 반응 억제 과제의 아이디어를 사용합니다.

- `commission_rate`: 누르면 안 되는 자극에 반응한 비율입니다. 높을수록 멈춤 조절 또는 억제 조절이 흔들렸을 수 있습니다.
- `fast_error_rate`: 지나치게 빠른 잘못된 반응 비율입니다. 자극을 충분히 확인하기 전에 반응하는 성급성을 보조적으로 봅니다.
- `mean_go_reaction_time`: Go 자극 평균 반응시간입니다. 지나치게 느리거나 빠른 반응을 다른 지표와 함께 해석합니다.
- `premature_response_count`: 기준 시간보다 너무 이른 반응 수입니다.

반응 억제 과제는 기기 지연, 터치 방식, 화면 크기, 사용자의 긴장도에 영향을 받기 때문에 단독 결론에 사용하지 않습니다.

## 14. 과제 3: 균형 유지

### 14.1 목적

균형 유지는 움직임 안정성, 대기/유지 상황에서의 자기조절 패턴을 보조적으로 확인합니다.

### 14.2 구현

- 본 과제 30초
- 모바일 센서 가능 시 `sensor`
- iPhone/iPad에서 권한 실패 또는 센서 미감지 시 `long_touch`
- PC/센서 없음 환경은 포인터 fallback
- 모바일/터치 조건이 아니면 PC에서 센서 모드로 진입하지 않도록 방어

### 14.3 저장 지표

- `stable_duration_pct`
- `spike_count`
- `total_movement`
- `input_source`

### 14.4 주요 이론

움직임 안정성은 과잉행동을 직접 진단하는 값이 아닙니다. 이 서비스에서는 30초 동안 얼마나 안정적으로 유지했는지, 큰 흔들림이 몇 번 있었는지, 입력 방식이 무엇이었는지를 기록해 활동성/자기조절의 보조 참고값으로만 사용합니다.

## 15. 통합 리포트 생성 원리

통합 리포트는 AI가 임의로 쓰는 문서가 아닙니다. 서버는 먼저 저장된 JSON을 읽고 결정론적으로 핵심 지표를 계산합니다. 이후 Gemini가 설정되어 있으면 일부 자연어와 계획 문구를 보조 생성합니다.

핵심 함수:

- `computeAssessmentMetrics(record)`
- `buildDeterministicReport(metrics)`
- `generateInsights(record)`

### 15.1 서버 계산 지표

`computeAssessmentMetrics()`는 아래 값을 계산합니다.

- 설문 완료 상태
- ASRS 평균
- ASRS 기준 이상 문항 수
- ASRS 집중 유지 점수
- ASRS 반응 조절 점수
- DSM 전체 Yes 수
- DSM 부주의 Yes 수
- DSM 과잉행동/충동성 Yes 수
- DSM 추가 확인 Yes 수
- DSM subtype
- 목표 놓침 비율
- 잘못된 반응 비율
- 반응시간 변동성
- tau
- 후반부 저하
- 성급 반응 비율
- Go 평균 반응시간
- 안정 유지 비율
- 큰 흔들림 횟수
- 주관적 주요 영역
- 객관적 주요 영역
- 주관-객관 일치 여부
- 일상 부담 수준
- 레이더 점수 5축

### 15.2 레이더 점수 5축

`config/report.json`의 축:

- 집중 유지
- 실행 기능
- 충동 조절
- 정서 안정
- 일상 구조화

서버는 설문과 반응성 과제의 지표를 조합해 20~95 범위의 점수를 생성합니다. 이 점수는 임상 점수가 아니라 화면에서 현재 패턴을 시각적으로 요약하기 위한 서비스 내부 지표입니다.

### 15.3 주관-객관 교차 확인

리포트는 크게 두 축을 비교합니다.

- 주관적 보고: 사용자가 설문에서 느낀 어려움
- 객관적 반응: 반응성 과제에서 실제 나타난 수행 패턴

`subjectiveDomain`은 설문 값에서 부주의/충동성 중 더 두드러진 쪽을 고릅니다. `objectiveDomain`은 주로 `omissionRate`와 `commissionRate`를 비교해 과제에서 더 두드러진 쪽을 고릅니다.

`alignment` 값:

- `일치`: 주관적 보고와 객관 수행이 비슷한 방향
- `불일치`: 평소 체감과 과제 결과가 다른 방향
- `혼합`: 두 신호가 함께 섞여 보이는 경우

### 15.4 일상 부담 수준

`dailyImpactLevel`은 DSM 전체 Yes 수와 추가 확인 문항을 가중해 1~5 범위로 보정합니다.

라벨:

- 1: 가벼운 피로
- 2: 조금 누적된 피로
- 3: 중간 수준의 부담
- 4: 지속적 소모가 큰 편
- 5: 상당한 에너지 소모

## 16. 실행 계획 생성 원리

실행 계획은 `determinePlanTendency()`와 `buildPlanForMetrics()`를 통해 기본 생성됩니다.

계획 유형:

- `inattention`: 집중 유지 부담 중심
- `impulsivity`: 반응 조절 부담 중심
- `combined`: 복합 실행 기능 패턴
- `very_low`: 큰 부담이 낮은 안정 범위

### 16.1 부주의형 경향 계획

중심 전략:

- 과제 분할
- 시각적 단서
- 환경 통제
- 시작 장벽 낮추기

예:

- 아침에 오늘 할 일을 A/B로 나누어 3개만 적기
- 집중 전 스마트폰을 보이지 않는 곳에 두기
- 딴생각이 나면 생각 노트에 단어 하나만 적고 돌아오기

### 16.2 반응 조절 경향 계획

중심 전략:

- 지연 행동
- 심호흡
- 자동 생각 기록
- 저녁 점검

예:

- 충동적 행동 전 제자리에서 심호흡 3번
- 결정을 내리기 전 스마트폰 메모장에 생각 한 줄 적기
- 저녁 5분 동안 감정 기복과 충동 행동 기록

### 16.3 복합형 경향 계획

중심 전략:

- 과제 쪼개기
- 충동 메모
- 하루 마무리 루틴

### 16.4 안정 범위 계획

중심 전략:

- 현재 루틴 유지
- 흔들리는 조건 기록
- 작은 반복 행동 강화

## 17. AI 사용 방식

이 서비스에는 전통적인 검색형 RAG가 없습니다. embedding, vector DB, 외부 문서 검색 단계는 없습니다. 대신 사용자 기록 JSON과 서버가 계산한 지표를 프롬프트에 직접 넣는 로컬 데이터 주입형 프롬프트 구조입니다.

### 17.1 AI 호출 지점

AI 호출은 총 5곳입니다.

```text
POST /api/ai/asrs-analysis
POST /api/ai/dsm-analysis
POST /api/ai/react-analysis
POST /api/ai/insights
POST /api/ai/chat
```

### 17.2 공통 Gemini 호출 구조

`callGeminiJson()`이 모든 AI 요청을 처리합니다.

공통 설정:

- `systemInstruction`
- `prompt`
- `schemaHint`
- `responseMimeType: "application/json"`
- `temperature: 0.7`

AI 응답은 `parseJsonLoose()`로 파싱합니다. 일반 JSON 파싱이 실패하면 markdown code fence 안의 JSON 또는 문자열 내부의 `{ ... }` 범위를 찾아 다시 파싱합니다.

### 17.3 안전장치

프롬프트에는 아래 규칙이 반복적으로 들어갑니다.

- 의학적 진단 표현 금지
- 정상/비정상, 위험군, 확정 표현 금지
- JSON에 없는 수치를 추정하지 않기
- 사용자가 선택한 설문만 근거로 사용하기
- 어려운 용어보다 쉬운 일상어 사용
- 계획은 의료적 처방이 아니라 일상 코칭 언어로 작성
- 한 번에 여러 행동보다 작은 다음 행동 중심

### 17.4 결정론 우선, AI 보조

`/api/ai/insights`라는 이름이지만 최종 리포트는 AI만으로 만들어지지 않습니다.

실제 순서:

1. 서버가 `computeAssessmentMetrics()`로 지표 계산
2. 서버가 `buildDeterministicReport()`로 기본 리포트와 기본 계획 생성
3. Gemini가 설정되어 있으면 자연어 표현과 계획을 보조 생성
4. 서버가 AI 응답과 결정론적 결과를 병합
5. 점수, severity, 일상 부담 수준 등 핵심 계산값은 서버 값을 우선 사용

이 구조는 AI의 표현력을 쓰면서도, 핵심 판단과 숫자가 저장 데이터에서 벗어나지 않게 하기 위한 설계입니다.

## 18. 디자인 테마 시스템

`designmd/` 폴더의 `DESIGN-*.md` 파일은 디자인 토큰 역할을 합니다.

서버 기능:

- front matter 추출
- 간단 YAML 파싱
- `{colors.primary}` 같은 토큰 참조 해석
- slug 생성
- 테마 목록 API 제공
- 개별 테마 API 제공

프런트 기능:

- `/api/design-themes`로 테마 목록 로드
- `/api/design-themes/:slug`로 테마 상세 로드
- CSS 변수로 색상, 타이포그래피, radius, spacing 적용
- URL 쿼리 `?theme=slug` 지원

## 19. DTx 숲 허브

`public/dtx/`는 리포트 이후 후속 행동 루프를 위한 실험 화면입니다.

주요 역할:

- 사용자 record 불러오기
- `dtx.stage`, `dtx.totalScore`, `dtx.scores` 관리
- `planGame`, `test1`, `test2` 등 후속 활동 점수 누적
- 튜토리얼 표시 여부 저장
- 연구 사용 로그 저장
- 숲/스테이지 컨셉으로 후속 행동 흐름 제공

DTx 자체는 별도 AI 요약을 만들지 않고, 이미 생성된 record, plan, dtx 상태를 사용합니다.

## 20. plangame 목표 체크

`public/plangame/`은 PLAN 단계에서 생성된 실행 계획을 목표 카드로 바꾸어 체크하는 화면입니다.

주요 기능:

- plan suggestions 기반 기본 목표 3개 생성
- 목표 문구 수정
- 목표 완료 시 점수 증가
- cooldown 적용
- `record.planGame`과 `record.dtx.scores.plangame` 저장
- DTx stage와 연동

이 기능은 리포트를 읽고 끝나는 것이 아니라, 작은 실천 행동을 반복하는 루프를 만들기 위한 실험 기능입니다.

## 21. 별도 미니게임 경로

`public/test1`, `public/test2`, `public/test3`은 DTx/후속 실험용 미니게임 경로입니다.

- `test1`: 신호 탐지형 미니게임
- `test2`: Go/No-Go형 미니게임
- `test3`: 균형/유지형 미니게임

이 경로들은 메인 `public/app.js` 안의 반응성 과제와 별도로, 튜토리얼/캐릭터/점수 흐름을 포함한 실험 화면으로 구현되어 있습니다.

## 22. `/game` 스토리 화면

`public/game/`은 `game/scripts/*.json`을 읽어 스토리/대화형 화면을 보여주는 별도 경로입니다.

주요 구성:

- `game/scripts/opening.json`
- `game/scripts/100.json` ~ `800.json`
- `game/scripts/plan.json`
- `game/images/`

단계별 배경과 캐릭터 대화를 불러와 렌더링합니다.

## 23. `/map` 구조도 화면

`public/map/`은 서비스 내부 데이터 흐름을 시각화합니다.

주요 기능:

- ASRS, DSM, 반응성, 리포트, 계획, AI API의 연결 구조 표시
- 노드/엣지 기반 구조도
- 노드 드래그
- 확대/축소
- 레이아웃 저장
- `/api/map-layout`으로 서버 저장

이 화면은 개발자나 발표자가 서비스 내부 구조를 설명할 때 사용하기 좋습니다.

## 24. 연구 사용 로그

메인 앱과 DTx 공통 유틸은 `researchUsage`를 기록합니다.

기록 대상 예:

- 접속 시각
- 마지막 활동 시각
- 체류 시간
- route 이동
- 주요 클릭/수행 이벤트
- viewport
- userAgent

브라우저 종료 또는 페이지 숨김 시 `navigator.sendBeacon()`으로 마지막 사용 로그를 저장하려고 시도합니다.

## 25. 주요 구현 이론 정리

### 25.1 자기보고와 수행 과제의 교차 검증

자기보고 설문은 실제 생활의 넓은 맥락을 반영하지만, 주관적 기억과 현재 감정 상태에 영향을 받습니다. 반대로 짧은 수행 과제는 특정 순간의 행동을 더 직접 측정하지만, 환경과 기기 조건에 영향을 받습니다. 이 서비스는 두 자료를 경쟁시키지 않고 서로 보완하는 방식으로 설계했습니다.

리포트에서 중요한 질문은 "사용자가 느끼는 어려움과 실제 과제 수행에서 보인 패턴이 같은 방향인가?"입니다. 그래서 리포트에는 주관적 보고, 객관적 반응, 일치/불일치가 명시적으로 들어갑니다.

### 25.2 결정론적 계산과 생성형 AI의 분리

핵심 지표 계산은 서버의 순수 함수에 가깝게 구성되어 있습니다. AI는 자연어 표현과 계획 조정을 돕지만, 저장 JSON에 없는 수치를 만들어 내거나 핵심 점수를 임의로 바꾸지 않도록 설계되어 있습니다.

이 구조의 장점:

- 같은 입력에 대해 핵심 수치가 안정적
- AI 미설정 상태에서도 기본 리포트 생성 가능
- AI 오류가 있어도 fallback 문구 사용 가능
- 데이터에 없는 내용을 추정하는 위험 감소

### 25.3 신호 탐지와 omission

신호 탐지 과제에서 사용자는 목표 자극에 반응해야 합니다. 목표를 놓친 `omission`은 집중 유지, 목표 탐지, 과제 몰입의 흔들림을 보조적으로 보여 줍니다. 하지만 이 값은 피로, 화면 터치 실패, 자극 이해도, 기기 렉에도 영향을 받을 수 있으므로 단독 해석하지 않습니다.

### 25.4 반응 억제와 commission

Go/No-Go 과제에서 `commission`은 누르면 안 되는 자극에 반응한 경우입니다. 이는 반응 억제 또는 멈춤 조절을 보는 대표적 수행 지표입니다. 서비스는 이를 충동성의 확정 지표로 보지 않고, "멈춰야 할 때 누른 반응"이라는 쉬운 표현으로 보조 설명합니다.

### 25.5 반응시간 변동성

평균 반응시간만으로는 집중 패턴을 충분히 설명하기 어렵습니다. 같은 평균이라도 어떤 사람은 꾸준히 반응하고, 어떤 사람은 빠른 반응과 매우 늦은 반응이 섞일 수 있습니다. 그래서 `reaction_time_variability`와 `tau`를 함께 봅니다.

### 25.6 후반부 저하

`late_phase_drop`은 과제 후반부에 정확도나 수행이 떨어지는지 보는 지표입니다. 지속주의 과제에서는 초반보다 후반의 변화가 중요할 수 있습니다. 서비스는 이를 "후반 유지력" 또는 "시간이 지나며 집중이 흔들리는 정도"로 설명합니다.

### 25.7 센서 fallback 설계

모바일 센서는 브라우저 권한, iOS 정책, 기기 종류에 따라 동작이 크게 달라집니다. 그래서 균형 유지 과제는 센서만 전제로 하지 않고 `sensor`, `long_touch`, `pointer` fallback을 가집니다. 입력 방식은 `input_source`로 저장해 해석 시 참고합니다.

### 25.8 행동 계획 이론

PLAN 단계의 제안은 거창한 치료 지시가 아니라 일상 행동 단위를 작게 만드는 데 초점을 둡니다.

핵심 원리:

- 시작 장벽 낮추기
- 행동을 시간/장소/단위로 구체화
- 환경 단서 사용
- 지연 행동으로 충동 반응 늦추기
- 하루 마무리 점검으로 피드백 루프 만들기

이는 실행 기능 부담이 있는 사용자에게 "의지만 더 내라"가 아니라 "환경과 행동 단위를 바꾸라"는 방향의 설계입니다.

## 26. 보안 및 안정성 고려

현재 구현된 방어:

- `safeJoin()`으로 정적 파일 경로 이탈 방지
- record 파일명은 basename, `.json` 확장자, `map-layout.json` 제외 조건으로 제한
- API body 크기 2MB 제한
- AI 응답 JSON 파싱 실패 시 error 처리
- Gemini API key 미설정 시 상태 API에서 `configured: false`
- 리포트 생성 시 AI가 없어도 결정론적 fallback 사용

현재 한계:

- 인증/인가 없음
- `database/*.json`은 로컬 파일 기반이므로 운영 환경에서는 접근 제어와 백업 전략 필요
- HTTPS, rate limit, CSRF, 계정 체계 없음
- 의료 정보에 가까운 민감 데이터가 포함될 수 있으므로 실제 서비스화 전 개인정보보호 설계 필요

## 27. 유용한 경로

```text
/                                      메인 앱
/?theme=kraken                         테마 강제 적용
/?route=report&id=test01               특정 ID의 리포트 진입
/?route=plan&id=test01                 특정 ID의 계획 진입
/?shortcut=reactivity&id=test01        반응성 과제 overview 진입
/?shortcut=reactivity&test=go_nogo&id=test01
/?shortcut=reactivity-result&test=balance_hold&id=test01
/dtx?id=test01                         DTx 숲 허브
/plangame?id=test01                    계획 목표 체크 게임
/map                                  구조도 맵
/game                                 스토리형 게임 화면
/test1                                후속 미니게임 1
/test2                                후속 미니게임 2
/test3                                후속 미니게임 3
```

## 28. 관련 문서

- `README.md`: 현재 요약 README
- `전체프로세스.md`: 입력, 저장, 계산, AI 연결 흐름
- `질문과해석.md`: 저장 JSON 값과 해석 규칙
- `jsonlist.md`: 핵심 JSON과 파생 변수 영향
- `rag.md`: AI 개입 지점과 프롬프트 입력 자료
- `sumlogic.md`: 화면별 요약 문장 생성 우선순위
- `반응성게임사양서.md`: 반응성 과제 상세 사양
- `구조설명.md`: 비전공자용 구조 설명
- `논문차용.md`: 논문/자료에서 차용한 개념
- `발표자료.md`: 프로젝트 발표용 자료

## 29. 서비스의 현재 성격

이 프로젝트는 상용 의료기기나 확정 진단 시스템이 아니라, 다음 목적을 가진 프로토타입입니다.

- 자기점검 흐름 설계
- 설문과 수행 과제의 통합 리포트 실험
- 결정론적 계산과 AI 자연어 보조의 하이브리드 구조 실험
- 리포트 이후 행동 계획 및 후속 루프 실험
- 발표/연구/서비스 기획을 위한 구현형 데모

따라서 결과 문구는 "진단", "판정", "위험군"이 아니라 "현재 보이는 패턴", "참고 신호", "추가로 살펴볼 지점"이라는 표현을 사용해야 합니다.

## 30. 핵심 결론

ADDFCS.COM의 핵심 구현 철학은 다음과 같습니다.

1. 사용자의 주관적 어려움을 먼저 존중한다.
2. 짧은 수행 과제로 실제 반응 패턴을 함께 본다.
3. 숫자와 핵심 판정은 서버가 결정론적으로 계산한다.
4. AI는 자연어 해석과 계획 조정을 보조한다.
5. 리포트는 단정이 아니라 교차 확인과 다음 행동을 위한 도구다.
6. 결과 이후에는 DTx, plangame, 미니게임으로 작은 행동 루프를 실험한다.

