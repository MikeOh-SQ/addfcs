# Intro Page Image Prompts

인트로 페이지용 AI 이미지 생성 프롬프트 정리 문서입니다.  
목표는 `ADDFCS.COM`의 첫 화면을 지금보다 더 풍부하고 랜딩 페이지답게 보이게 만드는 것입니다.

## Core Direction

- 주제: 주의·집중 자기점검, 집중 패턴, 반응성, 자기이해
- 무드: 프리미엄, 선명함, 미래지향, 과장되지 않은 의료/웰니스 테크
- 시각 언어: 대시보드 + 추상 데이터 + 사람 중심 감정
- 금지: 병원 홍보물 느낌, 차가운 스톡 사진, 유치한 만화, 과도한 사이버펑크
- 톤: 신뢰 가능하지만 딱딱하지 않음, 분석적이지만 인간적임
- 추천 비율:
  - 히어로 메인: `4:5` 또는 `1:1`
  - 와이드 배경: `16:9`
  - 카드용 비주얼: `1:1`
- 추천 출력 해상도:
  - 메인 히어로: `1536x1920` 이상
  - 카드형 보조 이미지: `1024x1024`
  - 배경형: `1792x1024`

## Shared Style Prompt

아래 문장은 대부분의 프롬프트 뒤에 공통으로 붙여서 쓰면 됩니다.

```text
premium mental wellness product illustration, clean cinematic lighting, layered composition, subtle neon accents in pink and violet, deep charcoal background, soft glass UI cards, elegant gradients, high contrast focal subject, sophisticated editorial product art, no text, no watermark, no logo
```

## Negative Prompt

```text
low quality, blurry, cluttered layout, hospital brochure, childish cartoon, horror mood, exaggerated medicalized symptoms, distorted hands, extra fingers, unreadable interface text, watermark, logo, stock photo smile, generic corporate team photo
```

## 1. Hero Main Illustration

용도:
- 인트로 첫 화면 오른쪽 대표 비주얼
- 현재 `intro-hero-illustration.svg`를 대체하거나 참고 이미지로 사용

프롬프트:

```text
A premium hero illustration for an focus-pattern self-check and focus pattern analysis app. A modern smartphone floats in the center, showing elegant dashboard cards, focus variability graphs, reaction task indicators, and calm summary panels. Around the phone, layered glowing metric cards orbit in space, suggesting attention drift, impulse control, and activity patterns. The scene should feel intelligent, emotionally aware, and futuristic without looking like science fiction. Background in deep charcoal with soft pink, lilac, and muted blue gradients. The composition should feel rich and high-end like a modern product landing page hero visual.

premium mental wellness product illustration, clean cinematic lighting, layered composition, subtle neon accents in pink and violet, deep charcoal background, soft glass UI cards, elegant gradients, high contrast focal subject, sophisticated editorial product art, no text, no watermark, no logo
```

메모:
- 사람보다 제품/인터페이스 중심
- 화면 텍스트는 생성하지 말고 카드와 그래프 형태만 보여주는 편이 안전

## 2. Human-Centered Hero Variant

용도:
- 첫 화면을 더 감정적으로 만들고 싶을 때
- 제품 화면만 있는 경우보다 공감감이 필요할 때

프롬프트:

```text
A stylish editorial illustration for an attention and executive-function self-check product. A young adult sits in a dim modern room, surrounded by floating fragments of tasks, notifications, checklists, and abstract motion trails, while a calm glowing smartphone interface organizes everything into clear focus cards. The contrast between mental noise and visual clarity should be central. The person looks thoughtful and slightly overwhelmed, but not distressed. The final mood should feel hopeful, intelligent, and beautifully composed.

premium mental wellness product illustration, clean cinematic lighting, layered composition, subtle neon accents in pink and violet, deep charcoal background, soft glass UI cards, elegant gradients, high contrast focal subject, sophisticated editorial product art, no text, no watermark, no logo
```

메모:
- 인물은 1명만
- 표정은 불안보다 “복잡함이 정리되는 직전” 느낌

## 3. Signal Map Card Illustration Set

용도:
- `signal map` 4개 카드에 각각 작은 썸네일이나 배경 이미지 추가할 때

### 3-1. Start Friction

```text
An abstract product illustration about difficulty starting tasks. A desk, open laptop, unfinished checklist, and a glowing start button remain untouched while time-like light trails move past. The composition should communicate hesitation, friction, and delayed initiation without looking sad or dramatic.

premium mental wellness product illustration, clean cinematic lighting, layered composition, subtle neon accents in pink and violet, deep charcoal background, soft glass UI cards, elegant gradients, high contrast focal subject, sophisticated editorial product art, no text, no watermark, no logo
```

### 3-2. Attention Drift

```text
An abstract illustration about attention drift. A reading line or target path begins crisp and aligned, then splits into soft drifting fragments and multiple faint layers before returning to a clear focal point. The image should visualize inconsistency, missed details, and focus variability in a refined way.

premium mental wellness product illustration, clean cinematic lighting, layered composition, subtle neon accents in pink and violet, deep charcoal background, soft glass UI cards, elegant gradients, high contrast focal subject, sophisticated editorial product art, no text, no watermark, no logo
```

### 3-3. Brake Failure

```text
An abstract product illustration about impulse control difficulty. A fast moving glowing object rushes toward a stop marker while a UI shield or soft barrier tries to intercept it. The scene should suggest premature response and reduced inhibition using elegant motion design language rather than literal danger.

premium mental wellness product illustration, clean cinematic lighting, layered composition, subtle neon accents in pink and violet, deep charcoal background, soft glass UI cards, elegant gradients, high contrast focal subject, sophisticated editorial product art, no text, no watermark, no logo
```

### 3-4. Restlessness

```text
An abstract product illustration about restlessness and difficulty staying still. A central sphere or seated silhouette remains in frame while rings, subtle motion echoes, and balance lines vibrate around it. The mood should feel controlled and analytical, not chaotic.

premium mental wellness product illustration, clean cinematic lighting, layered composition, subtle neon accents in pink and violet, deep charcoal background, soft glass UI cards, elegant gradients, high contrast focal subject, sophisticated editorial product art, no text, no watermark, no logo
```

## 4. Report Preview Image

용도:
- `report preview` 섹션 대표 이미지
- 리포트 화면 카드 옆에 별도 목업 이미지로 넣을 수 있음

프롬프트:

```text
A premium app report illustration for an attention and executive-function self-check experience. Multiple elegant panels show attention variability, impulsivity balance, activity signal, and a calm summary card. The interface should feel believable but not text-dependent, with charts, bars, radar-like motifs, and layered glass cards. The result should look like a polished product report from a premium health-tech landing page.

premium mental wellness product illustration, clean cinematic lighting, layered composition, subtle neon accents in pink and violet, deep charcoal background, soft glass UI cards, elegant gradients, high contrast focal subject, sophisticated editorial product art, no text, no watermark, no logo
```

## 5. Background Atmosphere Image

용도:
- 섹션 뒤에 희미하게 깔리는 와이드 배경
- CSS gradient 대신 보조 배경 텍스처로 사용 가능

프롬프트:

```text
An ultra-wide abstract atmospheric background for a premium focus and executive-function pattern analysis landing page. Soft glowing fields, blurred orbital paths, gentle layered data curves, and deep charcoal to violet gradients create a sense of intelligent motion and cognitive mapping. No central object, no readable interface, just beautiful spatial depth for a modern product website.

premium mental wellness product illustration, clean cinematic lighting, layered composition, subtle neon accents in pink and violet, deep charcoal background, soft glass UI cards, elegant gradients, high contrast focal subject, sophisticated editorial product art, no text, no watermark, no logo
```

## 6. Test Journey Illustration

용도:
- `journey` 또는 `step` 섹션 비주얼
- 평가 진행 흐름을 한 장으로 보여줄 때

프롬프트:

```text
A polished product illustration showing the journey of an focus-pattern self-check app: self report, pattern check, reaction task, and pattern report connected in a flowing visual sequence. Use a smartphone-centered composition with four layered stages, subtle arrows, cards, and data cues. The image should feel streamlined, reassuring, and premium.

premium mental wellness product illustration, clean cinematic lighting, layered composition, subtle neon accents in pink and violet, deep charcoal background, soft glass UI cards, elegant gradients, high contrast focal subject, sophisticated editorial product art, no text, no watermark, no logo
```

## 7. Scenario Images

용도:
- `for work`, `for students`, `for family` 카드에 개별 이미지 추가할 때

### 7-1. For Work

```text
A premium editorial illustration about work-related attention difficulty. A young professional sits in front of a laptop with multiple layered task windows, while a clean mobile report interface brings order to the scene. The mood is focused, modern, and realistic, not dramatic.

premium mental wellness product illustration, clean cinematic lighting, layered composition, subtle neon accents in pink and violet, deep charcoal background, soft glass UI cards, elegant gradients, high contrast focal subject, sophisticated editorial product art, no text, no watermark, no logo
```

### 7-2. For Students

```text
A premium editorial illustration about studying with fluctuating focus. Books, notes, reading lines, and subtle drifting layers surround a student, while a mobile interface highlights reading continuity and attention support. The image should feel intelligent, calm, and hopeful.

premium mental wellness product illustration, clean cinematic lighting, layered composition, subtle neon accents in pink and violet, deep charcoal background, soft glass UI cards, elegant gradients, high contrast focal subject, sophisticated editorial product art, no text, no watermark, no logo
```

### 7-3. For Family

```text
A premium editorial illustration about sharing hard-to-explain attention patterns with family. Two people sit together looking at a clear mobile report interface, with abstract emotional noise fading into structured visual cards. The image should communicate understanding, clarity, and conversation.

premium mental wellness product illustration, clean cinematic lighting, layered composition, subtle neon accents in pink and violet, deep charcoal background, soft glass UI cards, elegant gradients, high contrast focal subject, sophisticated editorial product art, no text, no watermark, no logo
```

## 8. Fast Production Order

시간이 없으면 아래 순서로 생성하면 됩니다.

1. `Hero Main Illustration`
2. `Report Preview Image`
3. `Background Atmosphere Image`
4. `Test Journey Illustration`
5. `Signal Map Card Illustration Set`
6. `Scenario Images`

## 9. Recommended File Naming

```text
intro-hero-main.png
intro-hero-human.png
intro-report-preview.png
intro-bg-atmosphere.png
intro-journey-flow.png
intro-signal-start.png
intro-signal-drift.png
intro-signal-brake.png
intro-signal-restless.png
intro-scenario-work.png
intro-scenario-student.png
intro-scenario-family.png
```

## 10. Practical Note

- 이미지 안에 실제 문장을 넣으려 하지 말고, UI 카드와 도형 위주로 생성하는 편이 리포트가 안정적입니다.
- 가장 먼저 만들 이미지는 `Hero Main Illustration` 하나면 충분합니다.
- 만약 생성 리포트가 너무 “의료 서비스”처럼 보이면 아래 문장을 추가하세요.

```text
more like a premium product landing page illustration, less like a hospital or clinic advertisement
```

- 리포트가 너무 SF처럼 보이면 아래 문장을 추가하세요.

```text
grounded, calm, believable, product-focused, not science fiction
```
