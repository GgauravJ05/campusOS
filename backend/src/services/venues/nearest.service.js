'use strict';

/**
 * "Nearest free venue": venues that are free for a requested window, ranked by
 * how far they are to walk from the building the person is in.
 *
 * The campus map is a graph (lib/ds/Graph.js) whose edges are the rows of
 * `campus_paths`. Dijkstra gives the shortest walking distance (and the route)
 * from the starting building to every other building. BFS answers a different
 * question - the fewest paths you could cross, ignoring their length - so the
 * two can disagree: the shortest walk may go around through a middle building
 * even though a longer direct path exists. Both are returned, named for what
 * they measure. Availability reuses the scheduling rules' clash check
 * (timeWindow.clashChecker), fed by one query for every candidate venue's
 * approved bookings rather than one query per venue.
 */

const db = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const settings = require('../settings.service');
const tw = require('../scheduling/timeWindow');
const Graph = require('../../lib/ds/Graph');
const selectSmallest = require('../../lib/ds/selectSmallest');

/** Bookings this far outside the window can still clash through a buffer or an overrun. */
const REACH_MINUTES = 180;
const MAX_LIMIT = 20;

/** The campus map as a graph, from the campus_paths table. */
async function loadCampusGraph(client = db) {
  const { rows } = await client.query('SELECT building_a, building_b, metres FROM campus_paths');
  const graph = new Graph();
  rows.forEach((row) => graph.addEdge(row.building_a, row.building_b, row.metres));
  return graph;
}

/**
 * @param {{ from: string, date: string, startTime: string, endTime: string,
 *           minCapacity?: number, type?: string, limit?: number }} query
 */
async function nearestFreeVenues({ from, date, startTime, endTime, minCapacity = 1, type = null, limit = 5 }) {
  const rules = await settings.getSchedulingRules();
  const problems = tw.validateWindow({ date, startTime, endTime }, rules);
  if (problems.length > 0) throw ApiError.validation('Choose a valid time', problems);

  const start = tw.toInstant(date, startTime);
  const end = tw.toInstant(date, endTime);
  const reach = REACH_MINUTES * 60 * 1000;

  const [{ rows: venues }, graph] = await Promise.all([
    db.query(
      `SELECT venue_id, venue_name, building, floor, venue_type, capacity, buffer_minutes
         FROM venues
        WHERE is_active AND capacity >= $1 AND ($2::text IS NULL OR venue_type = $2)`,
      [minCapacity, type],
    ),
    loadCampusGraph(),
  ]);

  const { rows: busyRows } = venues.length === 0 ? { rows: [] } : await db.query(
    `SELECT venue_id, start_at AS "startAt", end_at AS "endAt",
            buffer_minutes AS "bufferMinutes", extension_minutes AS "extensionMinutes"
       FROM bookings
      WHERE status = 'APPROVED' AND venue_id = ANY($1) AND start_at < $3 AND end_at > $2`,
    [venues.map((v) => v.venue_id), new Date(start.getTime() - reach), new Date(end.getTime() + reach)],
  );
  const busyByVenue = new Map();
  for (const row of busyRows) {
    if (!busyByVenue.has(row.venue_id)) busyByVenue.set(row.venue_id, []);
    busyByVenue.get(row.venue_id).push(row);
  }

  const { distance, previous } = graph.dijkstra(from);
  const hops = graph.bfs(from);

  const free = venues.filter((venue) => {
    const buffer = venue.buffer_minutes ?? rules.defaultBufferMinutes;
    const clashes = tw.clashChecker(busyByVenue.get(venue.venue_id) ?? [], buffer);
    return !clashes({ startAt: start, endAt: end, bufferMinutes: buffer });
  }).map((venue) => {
    // The person's own building is distance 0 even if it is not on the map.
    const here = venue.building === from;
    return {
      venue,
      metres: here ? 0 : (distance.get(venue.building) ?? null),
      fewestPaths: here ? 0 : (hops.get(venue.building) ?? null),
    };
  });

  // Nearest first; a venue with no known route sorts last. Then the tightest fit
  // (smallest capacity that is big enough), then name and id, so the order is total.
  const ranked = selectSmallest(free, Math.min(Math.max(Number(limit) || 5, 1), MAX_LIMIT), (a, b) => (
    (a.metres ?? Infinity) - (b.metres ?? Infinity)
    || a.venue.capacity - b.venue.capacity
    || a.venue.venue_name.localeCompare(b.venue.venue_name)
    || a.venue.venue_id - b.venue.venue_id
  ));

  return {
    from,
    fromIsOnMap: graph.has(from),
    window: { date, startTime, endTime },
    venues: ranked.map(({ venue, metres, fewestPaths }) => {
      const route = routeTo(venue.building, from, previous, metres);
      return {
        id: venue.venue_id,
        name: venue.venue_name,
        building: venue.building,
        floor: venue.floor,
        type: venue.venue_type,
        capacity: venue.capacity,
        walkingMetres: metres,
        route,
        // Paths crossed on that shortest walk (Dijkstra) ...
        buildingsAway: route ? route.length - 1 : null,
        // ... versus the fewest paths any route could cross (BFS); can be smaller.
        fewestPathsPossible: fewestPaths,
      };
    }),
  };
}

/** The buildings to walk through, start to destination, or null when there is no route. */
function routeTo(building, from, previous, metres) {
  if (building === from) return [from];
  if (metres === null) return null;
  const path = [building];
  while (path[0] !== from) path.unshift(previous.get(path[0]));
  return path;
}

module.exports = { nearestFreeVenues, loadCampusGraph, MAX_LIMIT };
