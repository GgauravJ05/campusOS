'use strict';

/**
 * Post-event feedback (DBMS Unit 5: semi-structured data).
 *
 * The 1-5 rating is a typed column. The follow-up questions differ by event
 * category, so the answers are one JSONB document per response - see
 * db/schema.sql section 13a for why. This file owns the only place those
 * per-category shapes are defined; the database accepts any JSON object, the
 * service accepts only the keys and value types listed here.
 *
 * Feedback is anonymous to the organiser: the summary returns counts and
 * free-text comments, never who said what.
 */

const db = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const events = require('./event.service');
const policy = require('./eligibility');

const BOOL = Object.freeze({ type: 'boolean' });
const COMMENT_MAX = 500;

/** Question sets by event category; every category also accepts `comment`. */
const QUESTIONS = Object.freeze({
  TECHNICAL: {
    difficulty: { type: 'enum', values: ['TOO_EASY', 'JUST_RIGHT', 'TOO_HARD'] },
    would_repeat: BOOL,
  },
  WORKSHOP: { materials_helpful: BOOL, would_repeat: BOOL },
  SEMINAR: { speaker_clear: BOOL, would_repeat: BOOL },
  CULTURAL: { well_organised: BOOL, would_repeat: BOOL },
  SPORTS: { fair_play: BOOL, facilities_good: BOOL },
  PLACEMENT: { relevant_to_me: BOOL, would_repeat: BOOL },
  SOCIAL: { well_organised: BOOL, would_repeat: BOOL },
  OTHER: { would_repeat: BOOL },
});

function questionsFor(category) {
  return QUESTIONS[category] || QUESTIONS.OTHER;
}

/** Rejects unknown keys and wrongly-typed values; returns the clean document. */
function cleanAnswers(category, answers = {}) {
  const spec = questionsFor(category);
  const details = [];
  const clean = {};

  for (const [key, value] of Object.entries(answers)) {
    if (key === 'comment') {
      if (typeof value !== 'string' || value.length > COMMENT_MAX) {
        details.push({ field: `answers.${key}`, message: `Comment must be text up to ${COMMENT_MAX} characters` });
      } else if (value.trim()) {
        clean.comment = value.trim();
      }
      continue;
    }
    const rule = spec[key];
    if (!rule) {
      details.push({ field: `answers.${key}`, message: 'Not a question for this kind of event' });
    } else if (rule.type === 'boolean' && typeof value !== 'boolean') {
      details.push({ field: `answers.${key}`, message: 'Answer yes or no' });
    } else if (rule.type === 'enum' && !rule.values.includes(value)) {
      details.push({ field: `answers.${key}`, message: `Choose one of ${rule.values.join(', ')}` });
    } else {
      clean[key] = value;
    }
  }

  if (details.length > 0) throw ApiError.validation('Check your answers', details);
  return clean;
}

/** The questions a student is asked for this event, so a client can render the form. */
async function form(actor, eventId) {
  const event = await events.getEvent(actor, eventId);
  return { rating: { min: 1, max: 5 }, questions: questionsFor(event.category), commentMaxLength: COMMENT_MAX };
}

/**
 * Records (or replaces) the student's feedback. They must have held a seat
 * and the event must have started - feedback on something that has not
 * taken place is a guess, not a review. (An event a student cannot see, such
 * as a cancelled one, never reaches this point: getEvent answers 404.)
 */
async function submit(actor, eventId, { rating, answers }) {
  const event = await events.getEvent(actor, eventId);
  if (!policy.hasStarted({ startAt: event.startAt })) {
    throw ApiError.conflict('This event has not started yet', { code: 'EVENT_NOT_STARTED' });
  }
  if (event.myRegistration?.status !== 'RESERVED') {
    throw ApiError.forbidden('Only students who held a seat can leave feedback');
  }

  const clean = cleanAnswers(event.category, answers);
  const { rows: [row] } = await db.query(
    `INSERT INTO event_feedback (event_id, student_id, rating, answers)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (event_id, student_id) DO UPDATE
        SET rating = EXCLUDED.rating, answers = EXCLUDED.answers, submitted_at = now()
     RETURNING rating, answers, submitted_at`,
    [eventId, actor.id, rating, JSON.stringify(clean)],
  );
  return { rating: row.rating, answers: row.answers, submittedAt: row.submitted_at };
}

/**
 * The organiser's view: how many responded, the rating spread, a tally for
 * every answered question, and the free-text comments.
 */
async function summary(actor, eventId) {
  const event = await events.getEvent(actor, eventId);
  if (!event.permissions.canViewRoster) {
    throw ApiError.forbidden('Only the organising club or its faculty can see feedback');
  }

  const [{ rows: [overall] }, { rows: spread }, { rows: tallies }, { rows: comments }, { rows: [repeat] }] = await Promise.all([
    db.query(
      `SELECT count(*)::int AS responses, avg(rating) AS avg_rating, min(rating) AS min_rating, max(rating) AS max_rating
         FROM event_feedback WHERE event_id = $1`,
      [eventId],
    ),
    db.query(
      `SELECT rating, count(*)::int AS n FROM event_feedback WHERE event_id = $1 GROUP BY rating ORDER BY rating`,
      [eventId],
    ),
    // One row per (question, answer) across every document: jsonb_each_text
    // turns each key/value pair of the JSONB object into a row, so a single
    // GROUP BY tallies questions the schema never had columns for.
    db.query(
      `SELECT a.key AS question, a.value AS answer, count(*)::int AS n
         FROM event_feedback f, jsonb_each_text(f.answers) a
        WHERE f.event_id = $1 AND a.key <> 'comment'
        GROUP BY a.key, a.value
        ORDER BY a.key, n DESC, a.value`,
      [eventId],
    ),
    db.query(
      `SELECT answers ->> 'comment' AS comment
         FROM event_feedback
        WHERE event_id = $1 AND answers ? 'comment'
        ORDER BY submitted_at DESC LIMIT 20`,
      [eventId],
    ),
    // Containment: the query shape the GIN index exists for.
    db.query(
      `SELECT count(*)::int AS n FROM event_feedback WHERE event_id = $1 AND answers @> '{"would_repeat": true}'`,
      [eventId],
    ),
  ]);

  const questions = {};
  for (const t of tallies) (questions[t.question] ||= {})[t.answer] = t.n;

  return {
    responses: overall.responses,
    averageRating: overall.responses ? Math.round(Number(overall.avg_rating) * 100) / 100 : null,
    minRating: overall.min_rating,
    maxRating: overall.max_rating,
    ratingSpread: Object.fromEntries(spread.map((r) => [r.rating, r.n])),
    questions,
    wouldRepeat: repeat.n,
    comments: comments.map((c) => c.comment),
  };
}

module.exports = { QUESTIONS, questionsFor, cleanAnswers, form, submit, summary };
