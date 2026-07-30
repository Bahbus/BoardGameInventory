import { useEffect, useMemo, useState } from "preact/hooks";
import {
  EMPTY_PROGRESS,
  houseAnswersToCsv,
  mergeHouseProgress,
  parseHouseEditorDataset,
  parseSavedHouseProgress,
  validateHouseAnswer,
  type HouseAnswer,
  type SavedHouseProgress
} from "./lib/houseEditor";
import {
  SetupVerificationError,
  submitHouseAnswers,
  type SetupSubmission
} from "./lib/setupAccess";

const STORAGE_KEY = "board-game-inventory:house-progress:v1";

const readProgress = (): SavedHouseProgress => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return EMPTY_PROGRESS;
    return parseSavedHouseProgress(JSON.parse(saved) as unknown);
  } catch {
    return EMPTY_PROGRESS;
  }
};

const download = (name: string, content: string, type: string) => {
  const url = URL.createObjectURL(new window.Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

const ratingOptions = [
  ["", "Not sure yet"],
  ["1", "1 — very low"],
  ["2", "2 — low"],
  ["3", "3 — medium"],
  ["4", "4 — high"],
  ["5", "5 — very high"]
];

function RatingField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(event) => onChange(event.currentTarget.value)}>
        {ratingOptions.map(([optionValue, optionLabel]) => (
          <option value={optionValue} key={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

const selectedModes = (value: string) =>
  value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);

export function HouseEditor({
  serviceUrl,
  grant,
  onVerificationLost
}: {
  serviceUrl: URL;
  grant: string;
  onVerificationLost: () => void;
}) {
  const [sourceGames, setSourceGames] = useState<HouseAnswer[]>([]);
  const [sourceSha, setSourceSha] = useState("");
  const [progress, setProgress] = useState<SavedHouseProgress>(readProgress);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<SetupSubmission>();

  useEffect(() => {
    fetch(new URL("api/setup/questionnaire", serviceUrl), {
      headers: { authorization: `Bearer ${grant}` }
    })
      .then((response) => {
        if (response.status === 401 || response.status === 403) {
          onVerificationLost();
          throw new Error("GitHub collaborator verification is no longer valid.");
        }
        if (!response.ok) throw new Error("The setup questionnaire could not be loaded.");
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        const dataset = parseHouseEditorDataset(value);
        setSourceSha(dataset.sourceSha);
        setSourceGames(dataset.games);
      })
      .catch((cause: Error) => setError(cause.message));
  }, [grant, onVerificationLost, serviceUrl]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  const games = useMemo(() => mergeHouseProgress(sourceGames, progress), [sourceGames, progress]);
  const current = games[index];
  const knownSlugs = new Set(sourceGames.map((game) => game.slug));
  const completed = new Set(progress.completedSlugs.filter((slug) => knownSlugs.has(slug)));
  const percent = games.length ? Math.round((completed.size / games.length) * 100) : 0;

  const update = <K extends keyof HouseAnswer>(key: K, value: HouseAnswer[K]) => {
    if (!current) return;
    setProgress((previous) => ({
      ...previous,
      answers: {
        ...previous.answers,
        [current.slug]: {
          ...(previous.answers[current.slug] ?? {}),
          [key]: value
        }
      }
    }));
    setNotice("");
  };

  const finishCurrent = () => {
    if (!current) return;
    const errors = validateHouseAnswer(current);
    if (errors.length) {
      setNotice(errors.join(" "));
      return;
    }
    setProgress((previous) => ({
      ...previous,
      completedSlugs: [...new Set([...previous.completedSlugs, current.slug])]
    }));
    setNotice(`${current.title} saved.`);
    if (index < games.length - 1) setIndex(index + 1);
  };

  const toggleMode = (mode: string) => {
    if (!current) return;
    const selected = selectedModes(current.modes);
    update(
      "modes",
      selected.includes(mode)
        ? selected.filter((value) => value !== mode).join(";")
        : [...selected, mode].join(";")
    );
  };

  const restoreProgress = async (file: { text(): Promise<string> } | undefined) => {
    if (!file) return;
    try {
      const restored = parseSavedHouseProgress(JSON.parse(await file.text()) as unknown);
      const knownSlugs = new Set(sourceGames.map((game) => game.slug));
      setProgress({
        schemaVersion: 1,
        answers: Object.fromEntries(
          Object.entries(restored.answers).filter(([slug]) => knownSlugs.has(slug))
        ),
        completedSlugs: restored.completedSlugs.filter((slug) => knownSlugs.has(slug))
      });
      setNotice("Progress restored from the selected backup.");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "That progress backup could not be read.");
    }
  };

  const submit = async () => {
    if (completed.size !== games.length || !sourceSha) return;
    setSubmitting(true);
    setNotice("");
    try {
      const result = await submitHouseAnswers(
        serviceUrl,
        grant,
        `${houseAnswersToCsv(games)}\n`,
        sourceSha
      );
      setSubmission(result);
    } catch (cause) {
      if (cause instanceof SetupVerificationError) {
        onVerificationLost();
        return;
      }
      setNotice(cause instanceof Error ? cause.message : "The setup answers could not be saved.");
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <section class="setup-shell">
        <div class="empty-state">
          <span aria-hidden="true">!</span>
          <h2>We couldn’t open game setup</h2>
          <p>{error}</p>
        </div>
      </section>
    );
  }

  if (!current) {
    return (
      <section class="setup-shell" aria-busy="true">
        <div class="setup-loading">Preparing the game list…</div>
      </section>
    );
  }

  return (
    <section class="setup-shell" aria-labelledby="setup-title">
      <div class="setup-overview">
        <div>
          <span class="eyebrow">Guided collection setup</span>
          <h1 id="setup-title">Tell us about the games</h1>
          <p>
            Answer what you know, one game at a time. Progress stays on this device while you work.
          </p>
        </div>
        <div class="setup-progress">
          <strong>
            {completed.size} of {games.length}
          </strong>
          <span>{percent}% complete</span>
          <progress max={games.length} value={completed.size}>
            {percent}%
          </progress>
        </div>
      </div>

      <div class="setup-toolbar">
        <label>
          Jump to a game
          <select value={index} onChange={(event) => setIndex(Number(event.currentTarget.value))}>
            {games.map((game, gameIndex) => (
              <option value={gameIndex} key={game.slug}>
                {completed.has(game.slug) ? "✓ " : ""}
                {game.title}
              </option>
            ))}
          </select>
        </label>
        <div class="setup-downloads">
          <button
            class="secondary-button dark"
            onClick={() =>
              download(
                "inventory-house-answers.csv",
                `${houseAnswersToCsv(games)}\n`,
                "text/csv;charset=utf-8"
              )
            }
          >
            Download CSV copy
          </button>
          <button
            class="text-button"
            onClick={() =>
              download(
                "inventory-house-progress.json",
                `${JSON.stringify(progress, null, 2)}\n`,
                "application/json"
              )
            }
          >
            Back up progress
          </button>
          <label class="restore-button">
            Restore progress
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => void restoreProgress(event.currentTarget.files?.[0])}
            />
          </label>
        </div>
      </div>

      {completed.size === games.length && (
        <div class="setup-complete" role="status">
          {submission ? (
            <>
              <strong>Setup answers are ready for review.</strong>
              <a href={submission.pullRequestUrl} target="_blank" rel="noreferrer">
                Open pull request #{submission.pullRequestNumber} on GitHub
              </a>
            </>
          ) : (
            <>
              <strong>Every game has a completed answer.</strong>
              <span>Save them to a new GitHub branch and pull request for review.</span>
              <button class="primary-button" disabled={submitting} onClick={() => void submit()}>
                {submitting ? "Saving to GitHub…" : "Save to GitHub"}
              </button>
            </>
          )}
        </div>
      )}

      <article class="setup-card">
        <header>
          <div>
            <span class="eyebrow">
              Game {index + 1} of {games.length}
            </span>
            <h2>{current.title}</h2>
          </div>
          {completed.has(current.slug) && <span class="complete-badge">Complete</span>}
        </header>

        <div class="setup-section">
          <div>
            <h3>The basics</h3>
            <p>These help us know whether the game can be offered tonight.</p>
          </div>
          <div class="setup-fields">
            <label>
              Is it available?
              <select
                value={current.availability}
                onChange={(event) => update("availability", event.currentTarget.value)}
              >
                <option value="available">Available</option>
                <option value="loaned">Loaned out</option>
                <option value="incomplete">Incomplete</option>
                <option value="unavailable">Otherwise unavailable</option>
              </select>
            </label>
            <label>
              Have you learned it?
              <select
                value={current.learned}
                onChange={(event) => update("learned", event.currentTarget.value)}
              >
                <option value="">Choose one</option>
                <option value="yes">Yes</option>
                <option value="no">Not yet</option>
              </select>
            </label>
            <label>
              Shelf label
              <input
                value={current.shelf}
                onInput={(event) => update("shelf", event.currentTarget.value)}
                placeholder="For example: Basement A3"
              />
            </label>
          </div>
        </div>

        <div class="setup-section">
          <div>
            <h3>Your experience</h3>
            <p>It is fine to leave ratings blank until the group has played it.</p>
          </div>
          <div class="setup-fields rating-grid">
            <RatingField
              label="Overall house rating"
              value={current.houseRating}
              onChange={(value) => update("houseRating", value)}
            />
            <label>
              Setup time in minutes
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={current.setupMinutes}
                onInput={(event) => update("setupMinutes", event.currentTarget.value)}
                placeholder="Not sure"
              />
            </label>
            <RatingField
              label="Teaching difficulty"
              value={current.teachDifficulty}
              onChange={(value) => update("teachDifficulty", value)}
            />
            <label>
              Table space
              <select
                value={current.tableSpace}
                onChange={(event) => update("tableSpace", event.currentTarget.value)}
              >
                <option value="">Not sure yet</option>
                <option value="compact">Compact — small table</option>
                <option value="standard">Standard — dining table</option>
                <option value="large">Large — needs extra room</option>
              </select>
            </label>
            <RatingField
              label="Player interaction"
              value={current.interaction}
              onChange={(value) => update("interaction", value)}
            />
            <RatingField
              label="Influence of luck"
              value={current.luck}
              onChange={(value) => update("luck", value)}
            />
            <RatingField
              label="Downtime between turns"
              value={current.downtime}
              onChange={(value) => update("downtime", value)}
            />
          </div>
        </div>

        <div class="setup-section">
          <div>
            <h3>How it plays</h3>
            <p>These answers improve preference matching. Use everyday words where prompted.</p>
          </div>
          <div class="setup-fields">
            <fieldset class="setup-modes">
              <legend>Supported styles</legend>
              {[
                ["competitive", "Competitive"],
                ["cooperative", "Cooperative"],
                ["team", "Teams"]
              ].map(([value, label]) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    checked={selectedModes(current.modes).includes(value)}
                    onChange={() => toggleMode(value)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <label>
              Mood or vibe
              <input
                value={current.moods}
                onInput={(event) => update("moods", event.currentTarget.value)}
                placeholder="Cozy, strategic, silly…"
              />
            </label>
            <label>
              Accessibility considerations
              <input
                value={current.accessibilityFlags}
                onInput={(event) => update("accessibilityFlags", event.currentTarget.value)}
                placeholder="Small text, color dependent…"
              />
            </label>
            <label>
              Content considerations
              <input
                value={current.contentFlags}
                onInput={(event) => update("contentFlags", event.currentTarget.value)}
                placeholder="Alcohol, horror, mature themes…"
              />
            </label>
            <label class="wide">
              Recommendation notes
              <textarea
                rows={3}
                value={current.recommendationNotes}
                onInput={(event) => update("recommendationNotes", event.currentTarget.value)}
                placeholder="Who tends to enjoy this game, or when does it work especially well?"
              />
            </label>
          </div>
        </div>

        {current.localValuesRequired === "yes" && (
          <div class="setup-section local-values">
            <div>
              <h3>Basic game details</h3>
              <p>This game is not on BGG, so these five answers are needed for filtering.</p>
            </div>
            <div class="setup-fields local-grid">
              {[
                ["localMinPlayers", "Minimum players"],
                ["localMaxPlayers", "Maximum players"],
                ["localMinMinutes", "Minimum minutes"],
                ["localMaxMinutes", "Maximum minutes"],
                ["localMinAge", "Minimum age"]
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={current[key as keyof HouseAnswer]}
                    onInput={(event) => update(key as keyof HouseAnswer, event.currentTarget.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        <div class="setup-actions">
          <button
            class="secondary-button dark"
            disabled={index === 0}
            onClick={() => setIndex(Math.max(0, index - 1))}
          >
            Previous
          </button>
          <button
            class="text-button"
            disabled={index === games.length - 1}
            onClick={() => setIndex(Math.min(games.length - 1, index + 1))}
          >
            Skip for now
          </button>
          <button class="primary-button" onClick={finishCurrent}>
            {index === games.length - 1 ? "Save game" : "Save & next"}
          </button>
        </div>
        <p class="setup-notice" aria-live="polite">
          {notice}
        </p>
      </article>

      <p class="setup-privacy">
        These answers are intended for this public inventory, so use shelf labels rather than
        addresses or private information.
      </p>
    </section>
  );
}
