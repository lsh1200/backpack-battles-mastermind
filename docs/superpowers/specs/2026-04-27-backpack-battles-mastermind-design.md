# Backpack Battles Mastermind Design

Date: 2026-04-27

## Goal

Build a mobile-friendly coaching assistant for Backpack Battles. The user plays the official Android version from Google Play, takes a screenshot of the current round, uploads it to the app, and receives the best next step with a concise explanation. The assistant should help the user learn quickly, not pretend to be a perfect autoplayer on day one.

The first version is a PWA/local web app with an LLM vision layer, deterministic pixel checks, a rules-and-knowledge layer, and an active correction loop. When recognition is uncertain, the app proactively asks targeted confirmation questions, saves the correction, and improves future recognition for the user's phone layout.

## Sources And Inputs

- Local transcript: `Default_Backpack Battles 101! Beginner & Interme.txt`
- BPB Builds: https://bpb-builds.vercel.app/
- BPB item database reference: https://bpb-builds.vercel.app/items
- Hybrid computer vision reference: https://github.com/SFStefenon/Digital_ED

BPB Builds is treated as a strategy and item reference. Digital_ED is used as architectural inspiration only: combine image/ML recognition with deterministic geometry and rules. This project will not copy Digital_ED's engineering-drawing pipeline, because Backpack Battles screenshots have a different layout, data model, and user workflow.

## Product Flow

1. The user takes a screenshot on Android.
2. The user opens the Backpack Battles Mastermind PWA and uploads the screenshot.
3. The app previews the screenshot and starts analysis.
4. The vision extractor asks an LLM vision model for structured game state.
5. The pixel validator checks screenshot geometry, likely UI regions, board/shop occupancy, and visual anchors.
6. The app compares the LLM state with deterministic checks.
7. If the state is clear, the app produces advice immediately.
8. If the state is uncertain, the app enters a correction loop with targeted questions.
9. The corrected state is passed to the decision engine.
10. The app shows the best step, why it matters, the plan it supports, and what to look for next.
11. The app saves the screenshot, extracted state, corrections, validation report, and final advice as a learning fixture.

## V1 Scope

V1 includes:

- Mobile-friendly screenshot upload and preview.
- LLM vision extraction into structured JSON.
- Pixel validation confidence report.
- Active correction loop for uncertain fields.
- Beginner strategy knowledge from the provided guide.
- Initial curated references to BPB Builds and known beginner plans.
- Recommendation output with best move, reason, plan, next targets, and assumptions.
- Local fixture storage for corrected examples.
- Unit tests for strategy rules and recommendation ranking.
- Fixture tests once real screenshots are provided.

V1 does not include:

- Automatic Android screen capture.
- Native Play Store packaging.
- Full combat simulation.
- Perfect item recognition without confirmation.
- Complete scraping or mirroring of BPB Builds.
- Guaranteed meta-perfect recommendations for every game patch.

The success criterion is practical: the user uploads a real Android screenshot and gets advice that is useful for the next move, while the system honestly asks for confirmation when recognition is not good enough.

## Architecture

The app should be built as a local-first Next.js PWA. This provides a phone-friendly interface, installable browser experience, API routes for LLM calls, straightforward testing, and a later path to deployment.

Core modules:

- `ScreenshotIntake`: accepts image upload, validates file type/size, previews the screenshot, and records analysis history.
- `VisionExtractor`: sends the screenshot to an LLM vision model and requests strict structured JSON.
- `PixelValidator`: runs deterministic checks on the image to locate likely UI regions, detect screenshot shape, sample anchors, and estimate occupied/empty shop and backpack regions.
- `CorrectionLoop`: turns uncertain fields into targeted confirmation questions and records the user's corrections.
- `KnowledgeBase`: stores strategy notes from the local guide, curated item/build references, class plans, signpost items, and round-based shop heuristics.
- `DecisionEngine`: ranks candidate actions using rules and the corrected game state.
- `CoachRenderer`: turns the selected action into plain learning-oriented advice.
- `FixtureStore`: saves screenshots, extracted state, corrections, validation reports, and final recommendations for future tests and recognition tuning.

Primary data flow:

`Screenshot -> VisionState -> ValidationReport -> CorrectionQuestions -> CorrectedGameState -> CandidateActions -> Recommendation -> Fixture`

## Data Model

`GameState` should include:

- `round`
- `gold`
- `lives`
- `wins`
- `className`
- `bagChoice`
- `skills`
- `subclass`
- `shopItems`
- `backpackItems`
- `storageItems`
- `battleLogSummary`, if visible or manually entered later
- `userGoal`, such as climb, learn, force a beginner plan, or experiment
- `uncertainFields`

`ValidationReport` should include:

- screenshot dimensions
- recognized orientation
- likely shop region
- likely backpack region
- known UI anchor checks
- occupied region estimates
- mismatches between image checks and LLM output
- fields requiring confirmation

`CandidateAction` should include:

- action type: buy, sell, roll, lock, reposition, combine, pick skill, pick subclass, or start battle
- target item or board area
- estimated value
- risks
- assumptions
- teaching reason

`Recommendation` should include:

- best action
- short reason
- rejected alternatives
- plan supported
- next targets
- assumptions made
- correction prompts used

## Recognition And Correction Loop

Low confidence must not end in vague advice. It must trigger an active learning loop.

When uncertainty is detected, the app should:

1. Highlight the uncertain fields.
2. Ask targeted questions with quick answers, such as:
   - "Is this shop item Broom or Pan?"
   - "Are you Ranger or Reaper?"
   - "Is your gold 7 or 9?"
   - "Is this item inside the backpack or still in storage?"
3. Prefer taps, dropdowns, and short typed corrections over asking the user to re-enter the whole board.
4. Recompute the recommendation after correction.
5. Save the corrected screenshot and state as a fixture.

The long-term recognition strategy is:

- collect real Android screenshots from the user's device;
- store corrected item crops and UI regions;
- use crop similarity, dimensions, and known UI anchors for faster future checks;
- improve LLM prompts with repeated failure cases;
- add deterministic checks for stable UI elements before expanding to full object recognition.

## Strategy Logic

The first strategy layer should encode beginner-friendly principles from the guide:

- stick with one main class while learning;
- always maintain a plan A;
- identify signpost items that justify pivots;
- respect shop rarity timing;
- buy sale items when they are effectively free or useful;
- watch for stamina pressure;
- value tempo when low on lives;
- avoid over-greedy economy habits while learning;
- consider opponent/battle feedback when available.

The initial class knowledge should be curated from the guide:

- Ranger: simple aggro plans around luck, crit, Hero Sword branches, arrows, stones, and poison/golem pivots.
- Reaper: beginner control plans around Coffin, poison, staff/cauldron style ideas, and major pivot signals.
- Berserker: simple double-axe plan, gloves, dragon-scaled items, and limited clear pivots.
- Pyromancer: beginner fire/dragon plan around Burning Blade, heat, fire items, dragons, and amulet-driven pivots.

The decision engine should rank actions conservatively. It should prefer teaching solid fundamentals over forcing flashy high-variance plays unless the board state clearly supports a pivot.

## UI

The PWA should open directly into the usable coaching flow, not a marketing page.

Main screens:

- Upload screen with screenshot preview.
- Analysis screen showing extracted state and validation warnings.
- Correction screen with targeted questions.
- Recommendation screen with best action, why, alternatives, next targets, and assumptions.
- History/fixtures screen for recent analyzed screenshots.

The UI should be compact and phone-first. It should use clear controls, small panels, and stable dimensions so item names, buttons, and previews do not shift around.

## Error Handling

- Non-image upload: reject with a clear message.
- Very large image: compress or ask the user to upload a smaller screenshot.
- Not a Backpack Battles screenshot: ask for a clearer in-game screenshot.
- LLM API failure: keep the screenshot and provide retry.
- Extraction/validation disagreement: enter correction loop.
- Unknown item: ask a targeted item-confirmation question or mark as unknown and avoid item-specific advice.
- Missing API key: show setup guidance in the local app.

## Testing

Testing should cover:

- Strategy rule unit tests.
- Recommendation ranking tests for known beginner scenarios.
- Vision schema validation tests using mocked LLM responses.
- Pixel validator tests with sample screenshots and synthetic crops.
- Correction loop tests proving uncertain fields produce targeted prompts.
- Fixture regression tests using the user's corrected screenshots.
- Mobile viewport browser checks for the core upload-to-recommendation flow.

The first screenshot fixtures should come from the user's Android device because device resolution, UI scaling, and game layout will drive recognition quality.

## Privacy And Storage

Screenshots may include game state but should still be treated as user data. By default, fixtures should be stored locally in the project during development. If the app is later deployed, screenshot storage should be explicit and controllable.

The LLM API key must stay server-side in a local environment variable or deployment secret. The browser client must never expose the key.

## Open Implementation Choices

- Exact LLM provider and model will be chosen during implementation based on available API keys and vision support.
- The first fixture storage can be filesystem-backed for local development, then moved to a database only if needed.
- BPB Builds integration starts as curated references and links. A full structured import is deferred until the core loop works.

## Approval Record

The user approved:

- PWA-first approach.
- Screenshot upload/share workflow for v1.
- LLM vision plus deterministic pixel checks.
- Coaching assistant scope rather than perfect autoplayer.
- Active confirmation and correction loop for uncertain recognition.
